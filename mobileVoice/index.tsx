import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Button, FluxDispatcher, Forms, Constants, RestAPI, SelectedChannelStore, SnowflakeUtils, Toasts, showToast, useState, useEffect, useRef } from "@webpack/common";
import { findLazy } from "@webpack";
import { CloudUpload as TCloudUpload } from "@vencord/discord-types";
import { CloudUploadPlatform } from "@vencord/discord-types/enums";
import { PermissionStore, PermissionsBits } from "@webpack/common";
import { PendingReplyStore, MessageActions } from "@webpack/common";

const CloudUpload: typeof TCloudUpload = findLazy(m => m.prototype?.trackUploadFinished);

// Mic icon like mobile
function MicIcon({ height = 20, width = 20, className }: any) {
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor" className={className}>
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
            <path d="M17 11a5 5 0 0 1-10 0M12 16v4M8 20h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
    );
}

function sendAudio(blob: Blob) {
    const channelId = SelectedChannelStore.getChannelId();
    if (!channelId) return;
    const reply = PendingReplyStore.getPendingReply(channelId);
    if (reply) FluxDispatcher.dispatch({ type: "DELETE_PENDING_REPLY", channelId });

    // Generate waveform + duration
    const send = async (waveform: string, duration: number) => {
        const upload = new CloudUpload({
            file: new File([blob], "voice-message.ogg", { type: "audio/ogg; codecs=opus" }),
            isThumbnail: false,
            platform: CloudUploadPlatform.WEB,
        }, channelId);

        upload.on("complete", () => {
            RestAPI.post({
                url: Constants.Endpoints.MESSAGES(channelId),
                body: {
                    flags: 1 << 13,
                    channel_id: channelId,
                    content: "",
                    nonce: SnowflakeUtils.fromTimestamp(Date.now()),
                    sticker_ids: [],
                    type: 0,
                    attachments: [{
                        id: "0",
                        filename: upload.filename,
                        uploaded_filename: upload.uploadedFilename,
                        waveform,
                        duration_secs: duration,
                    }],
                    message_reference: reply ? (MessageActions as any).getSendMessageOptionsForReply(reply)?.messageReference : null,
                }
            });
        });
        upload.on("error", () => showToast("Failed to upload voice message", Toasts.Type.FAILURE));
        upload.upload();
    };

    // compute waveform
    (async () => {
        try {
            const ctx = new AudioContext();
            const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
            const data = buf.getChannelData(0);
            const bins = new Uint8Array(Math.min(256, Math.max(32, Math.floor(buf.duration * 10))));
            const spb = Math.floor(data.length / bins.length);
            for (let i = 0; i < bins.length; i++) {
                let sum = 0;
                for (let j = 0; j < spb; j++) sum += data[i * spb + j] ** 2;
                bins[i] = Math.min(255, Math.sqrt(sum / spb) * 255);
            }
            const max = Math.max(...bins);
            const ratio = 1 + (255 / max - 1) * Math.min(1, 100 * (max / 255) ** 3);
            for (let i = 0; i < bins.length; i++) bins[i] = Math.min(255, bins[i] * ratio);
            const waveform = btoa(String.fromCharCode(...bins));
            send(waveform, buf.duration);
        } catch {
            send("AAAAAAAAAAAA", 1);
        }
    })();
}

const MobileMicButton: ChatBarButtonFactory = ({ channel }) => {
    const [recording, setRecording] = useState(false);
    const [locked, setLocked] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [cancel, setCancel] = useState(false);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<any>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const startXRef = useRef(0);

    // Check perms
    if (channel?.guild_id && !(PermissionStore.can(PermissionsBits.SEND_VOICE_MESSAGES, channel) && PermissionStore.can(PermissionsBits.SEND_MESSAGES, channel))) return null;

    const startRecording = async (e: any) => {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        startXRef.current = clientX;
        setCancel(false);
        setLocked(false);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const rec = new MediaRecorder(stream, { mimeType: 'audio/ogg; codecs=opus' });
            chunksRef.current = [];
            rec.ondataavailable = ev => { if (ev.data.size) chunksRef.current.push(ev.data); };
            rec.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/ogg; codecs=opus' });
                stream.getTracks().forEach(t => t.stop());
                if (!cancel && blob.size > 1000) sendAudio(blob);
                setRecording(false);
                setLocked(false);
                setElapsed(0);
                setCancel(false);
                clearInterval(timerRef.current);
            };
            recorderRef.current = rec;
            rec.start();
            setRecording(true);
            const start = Date.now();
            timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 100);
        } catch {
            showToast("Microphone permission denied", Toasts.Type.FAILURE);
        }
    };

    const stopRecording = (isCancel: boolean) => {
        if (isCancel) setCancel(true);
        clearInterval(timerRef.current);
        recorderRef.current?.stop();
    };

    const onMouseMove = (e: any) => {
        if (!recording || locked) return;
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        const delta = startXRef.current - x;
        // slide left 80px to cancel like mobile
        if (delta > 80) {
            setCancel(true);
            // visual feedback
        } else {
            setCancel(false);
        }
        // slide up to lock (like mobile lock)
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        if (e.clientY && window.innerHeight - y > 120) {
            // if dragged up, lock
        }
    };

    useEffect(() => {
        if (recording) {
            const move = (e: any) => onMouseMove(e);
            const up = () => {
                if (!locked) stopRecording(cancel);
                window.removeEventListener("mousemove", move);
                window.removeEventListener("mouseup", up);
                window.removeEventListener("touchmove", move);
                window.removeEventListener("touchend", up);
            };
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
            window.addEventListener("touchmove", move);
            window.addEventListener("touchend", up);
            return () => {
                window.removeEventListener("mousemove", move);
                window.removeEventListener("mouseup", up);
                window.removeEventListener("touchmove", move);
                window.removeEventListener("touchend", up);
            };
        }
    }, [recording, cancel, locked]);

    const format = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

    return (
        <>
            <ChatBarButton
                tooltip={recording ? (cancel ? "Release to cancel" : "Release to send — Slide left to cancel") : "Hold to record — Like mobile"}
                onClick={e => e.preventDefault()}
                buttonProps={{
                    onMouseDown: startRecording,
                    onTouchStart: startRecording,
                    style: {
                        color: recording ? (cancel ? "var(--status-danger)" : "var(--red-400)") : undefined,
                        transform: recording && !cancel ? "scale(1.15)" : undefined,
                        transition: "transform 0.1s"
                    }
                }}
            >
                <MicIcon />
            </ChatBarButton>

            {recording && (
                <div style={{
                    position: "absolute",
                    bottom: "100%",
                    left: 0,
                    right: 0,
                    marginBottom: 8,
                    background: cancel ? "var(--info-danger-background)" : "var(--background-secondary)",
                    border: `1px solid ${cancel ? "var(--info-danger-foreground)" : "var(--border-subtle)"}`,
                    borderRadius: 12,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                    zIndex: 10
                }}>
                    <div style={{
                        width: 12, height: 12, borderRadius: "50%",
                        background: cancel ? "var(--status-danger)" : "var(--red-400)",
                        animation: cancel ? undefined : "vc-pulse 1s infinite",
                        flexShrink: 0
                    }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: cancel ? "var(--info-danger-foreground)" : "var(--text-normal)" }}>
                            {cancel ? "↩ Slide to cancel" : locked ? "🔒 Locked — Tap send" : "● Recording... Slide left to cancel"}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.7, display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{format(elapsed)}</span>
                            <span style={{ flex: 1, height: 4, background: "var(--background-tertiary)", borderRadius: 99, overflow: "hidden", display: "flex" }}>
                                <span style={{ width: `${Math.min(100, (elapsed % 10) * 10)}%`, background: cancel ? "var(--status-danger)" : "var(--brand-500)", transition: "width 0.1s" }} />
                            </span>
                            {!locked && <span style={{ fontSize: 11, opacity: 0.6 }}>Hold & release to send</span>}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                        <Button size={Button.Sizes.TINY} color={Button.Colors.RED} onClick={() => stopRecording(true)}>Cancel</Button>
                        {locked ? <Button size={Button.Sizes.TINY} color={Button.Colors.GREEN} onClick={() => stopRecording(false)}>Send</Button> : <Button size={Button.Sizes.TINY} look={Button.Looks.LINK} onClick={() => setLocked(true)}>🔒 Lock</Button>}
                    </div>
                </div>
            )}
            <style>{`@keyframes vc-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
        </>
    );
};

export default definePlugin({
    name: "MobileVoice",
    description: "Voice messages exactly like mobile — hold mic in chat bar to record, slide to cancel, lock to continue. No more right-click menu.",
    authors: [{ name: "Motata", id: 0n }],
    tags: ["Voice", "Mobile"],
    chatBarButton: {
        icon: MicIcon,
        render: MobileMicButton
    }
});
