import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Button, Constants, FluxDispatcher, RestAPI, SelectedChannelStore, SnowflakeUtils, Toasts, showToast } from "@webpack/common";
import { findLazy } from "@webpack";
import { CloudUpload as TCloudUpload } from "@vencord/discord-types";
import { CloudUploadPlatform } from "@vencord/discord-types/enums";
import { PermissionStore, PermissionsBits } from "@webpack/common";
import { PendingReplyStore, MessageActions } from "@webpack/common";

const CloudUpload: typeof TCloudUpload = findLazy(m => m.prototype?.trackUploadFinished);

function sendAudio(blob: Blob) {
    const channelId = SelectedChannelStore.getChannelId();
    if (!channelId) return;
    const reply = PendingReplyStore.getPendingReply(channelId);
    if (reply) FluxDispatcher.dispatch({ type: "DELETE_PENDING_REPLY", channelId });

    const doUpload = async (waveform: string, duration: number) => {
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
                    attachments: [{ id: "0", filename: upload.filename, uploaded_filename: upload.uploadedFilename, waveform, duration_secs: duration }],
                    message_reference: reply ? (MessageActions as any).getSendMessageOptionsForReply(reply)?.messageReference : null,
                }
            });
        });
        upload.on("error", () => showToast("Upload failed", Toasts.Type.FAILURE));
        upload.upload();
    };

    (async () => {
        try {
            const ctx = new AudioContext();
            const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
            const data = buf.getChannelData(0);
            const bins = new Uint8Array(Math.min(256, Math.max(32, Math.floor(buf.duration * 10))));
            const spb = Math.floor(data.length / bins.length);
            for (let i = 0; i < bins.length; i++) { let s = 0; for (let j = 0; j < spb; j++) s += data[i * spb + j] ** 2; bins[i] = Math.min(255, Math.sqrt(s / spb) * 255); }
            const max = Math.max(...bins);
            const ratio = 1 + (255 / max - 1) * Math.min(1, 100 * (max / 255) ** 3);
            for (let i = 0; i < bins.length; i++) bins[i] = Math.min(255, bins[i] * ratio);
            doUpload(btoa(String.fromCharCode(...bins)), buf.duration);
        } catch { doUpload("AAAAAAAAAAAA", 1); }
    })();
}

export default definePlugin({
    name: "MobileVoice",
    description: "Hold mic in chat bar to record voice messages exactly like mobile — slide to cancel, live waveform.",
    authors: [{ name: "Motata", id: 0n }],
    tags: ["Voice"],

    start() {
        const STYLE_ID = "vc-mobileVoice-style";
        if (!document.getElementById(STYLE_ID)) {
            const s = document.createElement("style");
            s.id = STYLE_ID;
            s.textContent = `
                .vc-mobile-mic { width: 44px; height: 44px; display:flex; align-items:center; justify-content:center; border-radius:50%; background: var(--background-secondary); border: 1px solid var(--border-subtle); cursor:pointer; color: var(--interactive-normal); transition: transform 0.1s, background 0.1s; }
                .vc-mobile-mic:active { transform: scale(0.95); background: var(--brand-500); color: white; }
                .vc-mobile-mic.recording { background: var(--red-400); color: white; animation: vc-pulse 1s infinite; }
                .vc-mobile-mic.cancel { background: var(--status-danger); }
                @keyframes vc-pulse { 0%,100% { opacity:1 } 50% { opacity:0.7 } }
                .vc-mobile-overlay { position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); background: var(--background-secondary); border:1px solid var(--border-subtle); border-radius:16px; padding:12px 16px; display:flex; align-items:center; gap:12px; box-shadow:0 8px 24px rgba(0,0,0,0.4); z-index: 9999; min-width: 320px; max-width: 90vw; }
                .vc-mobile-overlay.cancel { background: var(--info-danger-background); border-color: var(--status-danger); }
                .vc-mobile-bars { display:flex; gap:2px; align-items:center; flex:1; height:24px; }
                .vc-mobile-bar { flex:1; background: var(--brand-500); border-radius:99px; min-height:4px; }
                .vc-mobile-bar.cancel { background: var(--status-danger); }
            `;
            document.head.appendChild(s);
        }

        let recording = false;
        let locked = false;
        let cancel = false;
        let startX = 0;
        let startY = 0;
        let recorder: MediaRecorder | null = null;
        let stream: MediaStream | null = null;
        let chunks: Blob[] = [];
        let timer: any = null;
        let elapsed = 0;
        let analyser: AnalyserNode | null = null;
        let audioCtx: AudioContext | null = null;
        let raf: number | null = null;
        let overlay: HTMLDivElement | null = null;
        let previewBlob: Blob | null = null;
        let previewUrl: string | null = null;

        const format = (s: number) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

        const createOverlay = () => {
            if (overlay) overlay.remove();
            overlay = document.createElement("div");
            overlay.className = "vc-mobile-overlay";
            document.body.appendChild(overlay);
            updateOverlay();
        };
        const updateOverlay = () => {
            if (!overlay) return;
            overlay.className = cancel ? "vc-mobile-overlay cancel" : "vc-mobile-overlay";
            overlay.innerHTML = "";
            const dot = document.createElement("div");
            dot.style.cssText = `width:12px;height:12px;border-radius:50%;background:${cancel ? "var(--status-danger)" : "var(--red-400)"};flex-shrink:0;`;
            if (!cancel) dot.style.animation = "vc-pulse 1s infinite";
            overlay.appendChild(dot);

            const mid = document.createElement("div");
            mid.style.cssText = "flex:1;display:flex;flex-direction:column;gap:4px;";
            const title = document.createElement("div");
            title.style.cssText = `font-weight:700;font-size:13px;color:${cancel ? "var(--info-danger-foreground)" : "var(--text-normal)"}`;
            title.textContent = cancel ? "↩ Slide to cancel" : locked ? "🔒 Locked — tap Send" : "● Recording... Slide left to cancel";
            mid.appendChild(title);

            const row = document.createElement("div");
            row.style.cssText = "display:flex;gap:8px;align-items:center;";
            const time = document.createElement("span");
            time.style.cssText = "font-variant-numeric:tabular-nums;font-weight:600;font-size:12px;";
            time.textContent = format(elapsed);
            row.appendChild(time);

            const bars = document.createElement("div");
            bars.className = "vc-mobile-bars";
            bars.id = "vc-live-bars";
            for (let i = 0; i < 24; i++) {
                const b = document.createElement("span");
                b.className = cancel ? "vc-mobile-bar cancel" : "vc-mobile-bar";
                b.style.height = "6px";
                bars.appendChild(b);
            }
            row.appendChild(bars);

            if (!locked) {
                const hint = document.createElement("span");
                hint.style.cssText = "font-size:11px;opacity:0.6;white-space:nowrap;";
                hint.textContent = "Hold";
                row.appendChild(hint);
            }
            mid.appendChild(row);
            overlay.appendChild(mid);

            const btns = document.createElement("div");
            btns.style.cssText = "display:flex;gap:6px;";
            const cancelBtn = document.createElement("button");
            cancelBtn.textContent = "Cancel";
            cancelBtn.style.cssText = "padding:4px 8px;border-radius:6px;border:none;background:var(--status-danger);color:white;cursor:pointer;font-size:12px;";
            cancelBtn.onclick = () => doCancel();
            btns.appendChild(cancelBtn);
            if (locked) {
                const sendBtn = document.createElement("button");
                sendBtn.textContent = "Send";
                sendBtn.style.cssText = "padding:4px 8px;border-radius:6px;border:none;background:var(--green-360);color:white;cursor:pointer;font-size:12px;";
                sendBtn.onclick = () => doSend();
                btns.appendChild(sendBtn);
            } else {
                const lockBtn = document.createElement("button");
                lockBtn.textContent = "🔒 Lock";
                lockBtn.style.cssText = "padding:4px 8px;border-radius:6px;border:none;background:transparent;color:var(--text-normal);cursor:pointer;font-size:12px;";
                lockBtn.onclick = () => { locked = true; updateOverlay(); };
                btns.appendChild(lockBtn);
            }
            overlay.appendChild(btns);
        };

        const doCancel = () => {
            cancel = true;
            stopRecording(true);
            overlay?.remove(); overlay = null;
            showToast("Cancelled", Toasts.Type.MESSAGE);
        };
        const doSend = () => {
            const blob = previewBlob || (chunks.length ? new Blob(chunks, { type: "audio/ogg; codecs=opus" }) : null);
            if (blob && blob.size > 1000) sendAudio(blob);
            cleanup();
        };
        const cleanup = () => {
            recording = false; locked = false; cancel = false; elapsed = 0;
            clearInterval(timer);
            if (raf) cancelAnimationFrame(raf);
            if (audioCtx) try { audioCtx.close(); } catch {}
            audioCtx = null; analyser = null;
            stream?.getTracks().forEach(t => t.stop());
            overlay?.remove(); overlay = null;
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewBlob = null; previewUrl = null;
            recorder = null; stream = null; chunks = [];
        };

        const startRecording = async (e: MouseEvent | TouchEvent) => {
            const cx = (e as TouchEvent).touches ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
            const cy = (e as TouchEvent).touches ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
            startX = cx; startY = cy;
            cancel = false; locked = false;
            createOverlay();
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true } as any);
                // live analyser
                try {
                    audioCtx = new AudioContext();
                    const src = audioCtx.createMediaStreamSource(stream);
                    analyser = audioCtx.createAnalyser();
                    analyser.fftSize = 256;
                    src.connect(analyser);
                    const data = new Uint8Array(analyser.frequencyBinCount);
                    const tick = () => {
                        if (!analyser || !recording) return;
                        analyser.getByteFrequencyData(data);
                        const barsEl = document.getElementById("vc-live-bars");
                        if (barsEl) {
                            const bars = barsEl.children;
                            const step = Math.floor(data.length / bars.length);
                            for (let i = 0; i < bars.length; i++) {
                                const v = data[i * step] || 0;
                                const h = 4 + (v / 255) * 18;
                                (bars[i] as HTMLElement).style.height = h + "px";
                            }
                        }
                        raf = requestAnimationFrame(tick);
                    };
                    tick();
                } catch {}
                recorder = new MediaRecorder(stream, { mimeType: "audio/ogg; codecs=opus" } as any);
                chunks = [];
                recorder.ondataavailable = ev => { if (ev.data.size) chunks.push(ev.data); };
                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });
                    if (!cancel && blob.size > 1000) {
                        // show preview like mobile
                        previewBlob = blob;
                        previewUrl = URL.createObjectURL(blob);
                        if (overlay) {
                            overlay.innerHTML = "";
                            const playBtn = document.createElement("button");
                            playBtn.textContent = "▶";
                            playBtn.style.cssText = "width:32px;height:32px;border-radius:50%;border:none;background:var(--brand-500);color:white;cursor:pointer;";
                            let audio: HTMLAudioElement | null = null;
                            let playing = false;
                            playBtn.onclick = () => {
                                if (!audio) { audio = new Audio(previewUrl!); audio.onended = () => { playing = false; playBtn.textContent = "▶"; }; }
                                if (playing) { audio.pause(); playing = false; playBtn.textContent = "▶"; } else { audio.play(); playing = true; playBtn.textContent = "⏸"; }
                            };
                            overlay.appendChild(playBtn);
                            const info = document.createElement("div");
                            info.style.cssText = "flex:1;font-size:13px;font-weight:600;";
                            info.textContent = "Preview — Tap Send to send like mobile";
                            overlay.appendChild(info);
                            const del = document.createElement("button");
                            del.textContent = "🗑";
                            del.style.cssText = "padding:6px 10px;border-radius:6px;border:none;background:var(--status-danger);color:white;cursor:pointer;";
                            del.onclick = () => { if (previewUrl) URL.revokeObjectURL(previewUrl); previewBlob = null; previewUrl = null; overlay?.remove(); overlay = null; };
                            const send = document.createElement("button");
                            send.textContent = "Send";
                            send.style.cssText = "padding:6px 12px;border-radius:6px;border:none;background:var(--green-360);color:white;cursor:pointer;font-weight:700;";
                            send.onclick = () => doSend();
                            overlay.appendChild(del);
                            overlay.appendChild(send);
                            return;
                        }
                        sendAudio(blob);
                    }
                    cleanup();
                };
                recorder.start();
                recording = true;
                const start = Date.now();
                timer = setInterval(() => { elapsed = Math.floor((Date.now() - start) / 1000); updateOverlay(); }, 100);
            } catch (err: any) {
                showToast("Microphone permission missing — Allow mic in Windows + Discord Voice settings", Toasts.Type.FAILURE);
                overlay?.remove(); overlay = null;
            }
        };

        const onMove = (e: MouseEvent | TouchEvent) => {
            if (!recording || locked) return;
            const x = (e as TouchEvent).touches ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
            const deltaX = startX - x;
            const y = (e as TouchEvent).touches ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
            if (deltaX > 70) cancel = true; else cancel = false;
            if (startY - y > 80) { locked = true; }
            updateOverlay();
        };
        const onUp = () => {
            if (!recording) return;
            if (!locked) {
                if (recorder && recorder.state === "recording") recorder.stop();
                else cleanup();
            }
            window.removeEventListener("mousemove", onMove as any);
            window.removeEventListener("mouseup", onUp);
            window.removeEventListener("touchmove", onMove as any);
            window.removeEventListener("touchend", onUp);
        };

        const injectButton = () => {
            if (document.getElementById("vc-mobile-mic-btn")) return;
            // Try many selectors like mobile chat bar - Discord's classes are hashed, so try multiple
            const candidates = [
                '[class*="channelTextArea"]',
                '[class*="chatContent"] form',
                'form[class*="form"]',
                '[class*="textArea"]',
                '[class*="scrollableContainer"]',
                'div[role="textbox"]',
            ];
            let bar: Element | null = null;
            for (const sel of candidates) {
                bar = document.querySelector(sel);
                if (bar) break;
            }
            if (!bar) {
                // Fallback: find any textbox
                const tb = document.querySelector('div[role="textbox"]');
                if (tb) bar = tb.closest('form') || tb.parentElement?.parentElement || tb as any;
            }
            if (!bar) return;
            // Find container for buttons
            let container: Element | null = bar.closest('[class*="channelTextArea"]') || bar.closest('form') || bar as any;
            if (!container || container === document.body) container =bar as any;
            // Try to find inner buttons area
            const inner = (container as any).querySelector?.('[class*="buttons"]') || (container as any).querySelector?.('[class*="inner"]') || container;
            const target = inner as HTMLElement;
            if (!target || target.querySelector("#vc-mobile-mic-btn")) return;

            console.log("[MobileVoice] Injecting mic button into", target);
            const btn = document.createElement("button");
            btn.id = "vc-mobile-mic-btn";
            btn.className = "vc-mobile-mic";
            btn.title = "Hold to record — Like mobile (mic permission granted?)";
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"/><path d="M17 11a5 5 0 0 1-10 0M12 16v4M8 20h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`;
            btn.onmousedown = (e) => { console.log("[MobileVoice] mousedown"); e.preventDefault(); startRecording(e); window.addEventListener("mousemove", onMove as any); window.addEventListener("mouseup", onUp); };
            btn.ontouchstart = (e) => { console.log("[MobileVoice] touchstart"); startRecording(e); window.addEventListener("touchmove", onMove as any); window.addEventListener("touchend", onUp); };
            btn.onclick = (e) => { e.preventDefault(); console.log("[MobileVoice] click - if you see this, injection works but hold failed"); };
            // Insert near send button or at end
            const sendBtn = target.querySelector('[class*="sendButton"]') || target.querySelector('button[type="submit"]');
            try {
                if (sendBtn && sendBtn.parentElement) sendBtn.parentElement.insertBefore(btn, sendBtn);
                else target.appendChild(btn);
            } catch { target.appendChild(btn); }
            console.log("[MobileVoice] Button injected!");
        };

        const obs = new MutationObserver(() => injectButton());
        obs.observe(document.body, { childList: true, subtree: true });
        // Try every second too (fallback if observer misses)
        const interval = setInterval(injectButton, 1000);
        injectButton();
        setTimeout(injectButton, 500);
        setTimeout(injectButton, 1500);
        (this as any)._obs = obs;
        (this as any)._interval = interval;
        (this as any)._cleanup = () => { cleanup(); clearInterval(interval); };
    },

    stop() {
        (this as any)._obs?.disconnect();
        clearInterval((this as any)._interval);
        (this as any)._cleanup?.();
        document.getElementById("vc-mobileVoice-style")?.remove();
        document.getElementById("vc-mobile-mic-btn")?.remove();
        document.querySelector(".vc-mobile-overlay")?.remove();
    }
});
