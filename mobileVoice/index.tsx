import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Button, FluxDispatcher, Forms, Constants, RestAPI, SelectedChannelStore, SnowflakeUtils, Toasts, showToast, useState, useEffect, useRef, MediaEngineStore } from "@webpack/common";
import { findLazy } from "@webpack";
import { CloudUpload as TCloudUpload } from "@vencord/discord-types";
import { CloudUploadPlatform } from "@vencord/discord-types/enums";
import { PermissionStore, PermissionsBits } from "@webpack/common";
import { PendingReplyStore, MessageActions } from "@webpack/common";

const CloudUpload: typeof TCloudUpload = findLazy(m => m.prototype?.trackUploadFinished);
const Native = (typeof VencordNative !== "undefined" ? (VencordNative as any).pluginHelpers?.VoiceMessages : null) as any;

// Mic icon EXACT copy from Discord Mobile (24x24, same path)
function MicIcon({ height = 22, width = 22, className }: any) {
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" fill="none" className={className} style={{ display: "block" }}>
            <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" fill="currentColor" />
            <path d="M19 10a7 7 0 0 1-14 0M12 16v4M8 20h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
    const [liveBars, setLiveBars] = useState<number[]>(Array(32).fill(4));
    const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewWaveform, setPreviewWaveform] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<any>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const startXRef = useRef(0);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const rafRef = useRef<number | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Check perms
    if (channel?.guild_id && !(PermissionStore.can(PermissionsBits.SEND_VOICE_MESSAGES, channel) && PermissionStore.can(PermissionsBits.SEND_MESSAGES, channel))) return null;

    const startRecording = async (e: any) => {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        startXRef.current = clientX;
        setCancel(false);
        setLocked(false);

        // Desktop: use Discord's native recorder (like VoiceMessages plugin) - respects Discord input device & bypasses browser permission issues
        if (typeof IS_DISCORD_DESKTOP !== "undefined" && IS_DISCORD_DESKTOP && typeof DiscordNative !== "undefined") {
            try {
                const discordVoice = (DiscordNative as any).nativeModules.requireModule("discord_voice");
                const deviceId = MediaEngineStore.getInputDeviceId();
                discordVoice.startLocalAudioRecording(
                    { echoCancellation: true, noiseCancellation: true, deviceId },
                    (success: boolean) => {
                        if (!success) {
                            showToast("Failed to start recording — check Windows Settings → Privacy → Microphone → Allow Discord, and Discord Settings → Voice → Input Device", Toasts.Type.FAILURE);
                            return;
                        }
                        setRecording(true);
                        const start = Date.now();
                        timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 100);
                        // Store a marker so stopRecording knows it's native
                        (recorderRef as any).current = "native";
                        streamRef.current = null as any;
                    }
                );
                return;
            } catch (err) {
                console.error("[MobileVoice] native start failed, falling back to getUserMedia", err);
            }
        }

        // Web / fallback with live waveform
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, deviceId: MediaEngineStore.getInputDeviceId() } as any });
            streamRef.current = stream;
            // live analyser
            try {
                const ctx = new AudioContext();
                audioCtxRef.current = ctx;
                const src = ctx.createMediaStreamSource(stream);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 256;
                src.connect(analyser);
                analyserRef.current = analyser;
                const data = new Uint8Array(analyser.frequencyBinCount);
                const tick = () => {
                    if (!analyserRef.current) return;
                    analyser.getByteFrequencyData(data);
                    const bars = [];
                    const step = Math.floor(data.length / 32);
                    for (let i = 0; i < 32; i++) {
                        const v = data[i * step] || 0;
                        bars.push(4 + (v / 255) * 20);
                    }
                    setLiveBars(bars);
                    rafRef.current = requestAnimationFrame(tick);
                };
                tick();
            } catch {}
            const rec = new MediaRecorder(stream, { mimeType: 'audio/ogg; codecs=opus' } as any);
            chunksRef.current = [];
            rec.ondataavailable = ev => { if (ev.data.size) chunksRef.current.push(ev.data); };
            rec.onstop = () => {
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; }
                analyserRef.current = null;
                setLiveBars(Array(32).fill(4));
                const blob = new Blob(chunksRef.current, { type: 'audio/ogg; codecs=opus' });
                stream.getTracks().forEach(t => t.stop());
                if (cancel || blob.size < 1000) {
                    setRecording(false); setLocked(false); setElapsed(0); setCancel(false); clearInterval(timerRef.current); return;
                }
                // Show preview like mobile - voir en direct
                const url = URL.createObjectURL(blob);
                setPreviewBlob(blob);
                setPreviewUrl(url);
                // waveform for preview
                (async () => {
                    try {
                        const ctx2 = new AudioContext();
                        const buf = await ctx2.decodeAudioData(await blob.arrayBuffer());
                        const data2 = buf.getChannelData(0);
                        const bins = new Uint8Array(Math.min(32, Math.floor(buf.duration * 10)));
                        const spb = Math.floor(data2.length / bins.length);
                        for (let i = 0; i < bins.length; i++) { let sum=0; for(let j=0;j<spb;j++) sum+= data2[i*spb+j]**2; bins[i]=Math.min(255, Math.sqrt(sum/spb)*255); }
                        setPreviewWaveform(btoa(String.fromCharCode(...bins)));
                    } catch { setPreviewWaveform(null); }
                })();
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
        } catch (err: any) {
            console.error(err);
            showToast("Microphone permission missing — Enable in Windows Settings → Privacy & security → Microphone → Allow Discord, and check Discord Settings → Voice & Video → Input Device", Toasts.Type.FAILURE);
        }
    };

    const stopRecording = (isCancel: boolean) => {
        if (isCancel) setCancel(true);
        clearInterval(timerRef.current);
        // Native desktop path
        if ((recorderRef as any).current === "native" && typeof DiscordNative !== "undefined") {
            try {
                const discordVoice = (DiscordNative as any).nativeModules.requireModule("discord_voice");
                discordVoice.stopLocalAudioRecording(async (filePath: string) => {
                    if (filePath && Native) {
                        try {
                            const buf = await Native.readRecording(filePath);
                            if (buf) {
                                const blob = new Blob([buf], { type: "audio/ogg; codecs=opus" });
                                if (isCancel || blob.size < 1000) { setRecording(false); setLocked(false); setElapsed(0); setCancel(false); (recorderRef as any).current = null; return; }
                                const url = URL.createObjectURL(blob);
                                setPreviewBlob(blob);
                                setPreviewUrl(url);
                                try {
                                    const ctx2 = new AudioContext();
                                    const buf2 = await ctx2.decodeAudioData(await blob.slice().arrayBuffer());
                                    const data2 = buf2.getChannelData(0);
                                    const bins = new Uint8Array(Math.min(32, Math.floor(buf2.duration * 10)));
                                    const spb = Math.floor(data2.length / bins.length);
                                    for (let i = 0; i < bins.length; i++) { let sum=0; for(let j=0;j<spb;j++) sum+= data2[i*spb+j]**2; bins[i]=Math.min(255, Math.sqrt(sum/spb)*255); }
                                    setPreviewWaveform(btoa(String.fromCharCode(...bins)));
                                } catch { setPreviewWaveform(null); }
                            } else showToast("Failed to read recording", Toasts.Type.FAILURE);
                        } catch { showToast("Failed to read recording", Toasts.Type.FAILURE); }
                    } else if (filePath) {
                        showToast("Native helper missing — enable VoiceMessages plugin too", Toasts.Type.FAILURE);
                    }
                    setRecording(false);
                    setLocked(false);
                    setElapsed(0);
                    setCancel(false);
                    (recorderRef as any).current = null;
                });
                return;
            } catch {}
        }
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

    // Inject exact mobile CSS (copied from Discord Mobile)
    useEffect(() => {
        const id = "vc-mobileVoice-mobile-css";
        if (document.getElementById(id)) return;
        const s = document.createElement("style");
        s.id = id;
        s.textContent = `
            /* Exact copy of Discord Mobile voice bar */
            .vc-mobile-overlay {
                position: absolute !important;
                bottom: 100% !important;
                left: 8px !important;
                right: 8px !important;
                margin-bottom: 8px !important;
                background: #2b2d31 !important;
                border: 1px solid #1e1f22 !important;
                border-radius: 18px !important;
                padding: 10px 12px !important;
                display: flex !important;
                align-items: center !important;
                gap: 12px !important;
                box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;
                z-index: 9999 !important;
                height: 56px !important;
                box-sizing: border-box !important;
            }
            .vc-mobile-overlay.cancel { background: #3a1f1f !important; border-color: #ed4245 !important; }
            /* Mic button exact mobile */
            .vc-chatbar-button [class*="button"] { background: transparent !important; }
        `;
        document.head.appendChild(s);
    }, []);

    return (
        <>
            <ChatBarButton
                tooltip={recording ? (cancel ? "Release to cancel" : "Release to send — Slide left to cancel") : "Hold to record — Like mobile"}
                onClick={e => e.preventDefault()}
                buttonProps={{
                    onMouseDown: startRecording,
                    onTouchStart: startRecording,
                    style: {
                        background: recording ? (cancel ? "#ed4245" : "#23a55a") : "#2b2d31",
                        color: "white",
                        borderRadius: "50%",
                        width: "32px",
                        height: "32px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transform: recording && !cancel ? "scale(1.08)" : undefined,
                        transition: "all 0.12s",
                        border: "none",
                        boxShadow: recording ? "0 2px 8px rgba(0,0,0,0.3)" : "none"
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
                            <span style={{ flex: 1, height: 12, display: "flex", gap: 2, alignItems: "center" }}>
                                {liveBars.map((h, i) => <span key={i} style={{ flex: 1, height: `${h}px`, background: cancel ? "var(--status-danger)" : "var(--brand-500)", borderRadius: 99, opacity: 0.9 }} />)}
                            </span>
                            {!locked && <span style={{ fontSize: 11, opacity: 0.6 }}>Hold & release</span>}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                        <Button size={Button.Sizes.TINY} color={Button.Colors.RED} onClick={() => stopRecording(true)}>Cancel</Button>
                        {locked ? <Button size={Button.Sizes.TINY} color={Button.Colors.GREEN} onClick={() => stopRecording(false)}>Send</Button> : <Button size={Button.Sizes.TINY} look={Button.Looks.LINK} onClick={() => setLocked(true)}>🔒 Lock</Button>}
                    </div>
                </div>
            )}
            {previewBlob && previewUrl && !recording && (
                <div style={{
                    position: "absolute",
                    bottom: "100%",
                    left: 0,
                    right: 0,
                    marginBottom: 8,
                    background: "var(--background-secondary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 12,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                    zIndex: 10
                }}>
                    <Button size={Button.Sizes.TINY} onClick={() => {
                        if (!audioRef.current) { const a = new Audio(previewUrl); audioRef.current = a; a.onended = () => setIsPlaying(false); a.onplay = () => setIsPlaying(true); a.onpause = () => setIsPlaying(false); }
                        if (isPlaying) { audioRef.current.pause(); } else { audioRef.current.play(); }
                    }}>{isPlaying ? "⏸" : "▶"}</Button>
                    <div style={{ flex: 1, height: 24, display: "flex", gap: 2, alignItems: "center" }}>
                        {previewWaveform ? Array.from(atob(previewWaveform)).map((c, i) => {
                            const h = (c.charCodeAt(0) / 255) * 20 + 4;
                            return <span key={i} style={{ flex: 1, height: `${h}px`, background: "var(--brand-500)", borderRadius: 99 }} />;
                        }) : <span style={{ fontSize: 12, opacity: 0.6 }}>Preview — voir en direct comme sur mobile</span>}
                    </div>
                    <Button size={Button.Sizes.TINY} color={Button.Colors.RED} onClick={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewBlob(null); setPreviewUrl(null); setPreviewWaveform(null); if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } }}>🗑</Button>
                    <Button size={Button.Sizes.TINY} color={Button.Colors.GREEN} onClick={() => { if (previewBlob) sendAudio(previewBlob); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewBlob(null); setPreviewUrl(null); setPreviewWaveform(null); }}>Send</Button>
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
