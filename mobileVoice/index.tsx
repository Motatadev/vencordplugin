import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Button, Constants, FluxDispatcher, RestAPI, SelectedChannelStore, SnowflakeUtils, Toasts, showToast, MediaEngineStore } from "@webpack/common";
import { findLazy } from "@webpack";
import { CloudUpload as TCloudUpload } from "@vencord/discord-types";
import { CloudUploadPlatform } from "@vencord/discord-types/enums";
import { PermissionStore, PermissionsBits } from "@webpack/common";
import { PendingReplyStore, MessageActions } from "@webpack/common";

const CloudUpload: typeof TCloudUpload = findLazy(m => m.prototype?.trackUploadFinished);
const Native = (typeof VencordNative !== "undefined" ? (VencordNative as any).pluginHelpers?.VoiceMessages : null) as any;

function sendAudio(blob: Blob) {
    const channelId = SelectedChannelStore.getChannelId();
    if (!channelId) return;
    const reply = PendingReplyStore.getPendingReply(channelId);
    if (reply) FluxDispatcher.dispatch({ type: "DELETE_PENDING_REPLY", channelId });
    const doUpload = async (waveform: string, duration: number) => {
        const upload = new CloudUpload({ file: new File([blob], "voice-message.ogg", { type: "audio/ogg; codecs=opus" }), isThumbnail: false, platform: CloudUploadPlatform.WEB }, channelId);
        upload.on("complete", () => {
            RestAPI.post({ url: Constants.Endpoints.MESSAGES(channelId), body: { flags: 1<<13, channel_id: channelId, content: "", nonce: SnowflakeUtils.fromTimestamp(Date.now()), sticker_ids: [], type: 0, attachments: [{ id: "0", filename: upload.filename, uploaded_filename: upload.uploadedFilename, waveform, duration_secs: duration }], message_reference: reply ? (MessageActions as any).getSendMessageOptionsForReply(reply)?.messageReference : null } });
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
            for (let i=0;i<bins.length;i++){let s=0;for(let j=0;j<spb;j++) s+= data[i*spb+j]**2; bins[i]=Math.min(255, Math.sqrt(s/spb)*255);}
            const max=Math.max(...bins); const ratio=1+(255/max-1)*Math.min(1,100*(max/255)**3);
            for(let i=0;i<bins.length;i++) bins[i]=Math.min(255,bins[i]*ratio);
            doUpload(btoa(String.fromCharCode(...bins)), buf.duration);
        } catch { doUpload("AAAAAAAAAAAA", 1); }
    })();
}

export default definePlugin({
    name: "MobileVoice",
    description: "Hold mic in chat bar to record voice messages exactly like mobile â€” slide to cancel, live waveform.",
    authors: [{ name: "Motata", id: 0n }],
    tags: ["Voice"],
    start() {
        console.log("[MobileVoice] start - direct DOM mode");
        const STYLE_ID = "vc-mobileVoice-style";
        if (!document.getElementById(STYLE_ID)) {
            const s = document.createElement("style");
            s.id = STYLE_ID;
            s.textContent = `
                /* Exact mobile copy - mic button 32px #2b2d31 */
                .vc-mobile-mic { width: 32px; height: 32px; display:flex; align-items:center; justify-content:center; border-radius:50%; background: #2b2d31; border: none; cursor:pointer; color: white; transition: all 0.12s; flex-shrink:0; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
                .vc-mobile-mic:active { transform: scale(0.92); background: #404249; }
                .vc-mobile-mic.recording { background: #ed4245; animation: vc-pulse 1s infinite; }
                /* Mobile recording bar - 56px #2b2d31 #1e1f22 24px radius like mobile */
                .vc-mobile-overlay { position: fixed; bottom: 88px; left: 50%; transform: translateX(-50%); background: #313338; border: 1px solid #1e1f22; border-radius: 24px; padding: 0 16px; display:flex; align-items:center; gap:12px; box-shadow: 0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.1); z-index:9999; min-width:340px; max-width:92vw; height:48px; box-sizing:border-box; }
                .vc-mobile-overlay.cancel { background: #3a1f1f; border-color: #ed4245; }
                .vc-mobile-bars { display:flex; gap:2px; align-items:center; flex:1; height:20px; }
                .vc-mobile-bar { flex:1; background: #80848e; border-radius:99px; min-height:3px; max-height:18px; }
                .vc-mobile-lock { position: fixed; bottom: 150px; left: 50%; transform: translateX(-50%); background: #2b2d31; border: 1px solid #1e1f22; border-radius: 12px; padding: 8px 12px; display:flex; flex-direction:column; align-items:center; gap:4px; box-shadow:0 4px 12px rgba(0,0,0,0.3); z-index:9998; }
                .vc-mobile-lock-line { width:2px; height:24px; background: repeating-linear-gradient(to bottom, #80848e 0 4px, transparent 4px 8px); }
                @keyframes vc-pulse { 0%,100% { opacity:1; transform: scale(1); } 50% { opacity:0.8; transform: scale(1.05); } }
            `;
            document.head.appendChild(s);
        }
        let recording=false, locked=false, cancel=false, startX=0;
        let recorder: any=null, stream: any=null, chunks: Blob[]=[], timer:any=null, elapsed=0;
        let analyser: any=null, audioCtx: any=null, raf: any=null;
        let overlay: HTMLDivElement | null = null;
        let previewBlob: Blob | null = null, previewUrl: string | null = null;

        const format = (s:number) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

        const createOverlay = () => {
            if (overlay) overlay.remove();
            overlay = document.createElement("div");
            overlay.className = "vc-mobile-overlay";
            document.body.appendChild(overlay);
            updateOverlay();
            console.log("[MobileVoice] overlay created");
        };
        const updateOverlay = () => {
            if (!overlay) return;
            overlay.className = cancel ? "vc-mobile-overlay cancel" : "vc-mobile-overlay";
            overlay.innerHTML = "";
            const dot = document.createElement("div");
            dot.style.cssText = `width:12px;height:12px;border-radius:50%;background:${cancel ? "#ed4245" : "#f23f42"};flex-shrink:0;`;
            if (!cancel) (dot.style as any).animation = "vc-pulse 1s infinite";
            overlay.appendChild(dot);
            const mid = document.createElement("div");
            mid.style.cssText = "flex:1;display:flex;flex-direction:column;gap:4px;";
            const title = document.createElement("div");
            title.style.cssText = `font-weight:700;font-size:13px;color:${cancel ? "#fa777c" : "white"}`;
            title.textContent = cancel ? "â†© Slide to cancel" : locked ? "ðŸ”’ Locked â€” tap Send" : "â— Recording... Slide left to cancel";
            mid.appendChild(title);
            const row = document.createElement("div");
            row.style.cssText = "display:flex;gap:8px;align-items:center;";
            const time = document.createElement("span");
            time.style.cssText = "font-variant-numeric:tabular-nums;font-weight:600;font-size:12px;color:white;";
            time.textContent = format(elapsed);
            row.appendChild(time);
            const bars = document.createElement("div");
            bars.className = "vc-mobile-bars";
            bars.id = "vc-live-bars";
            for(let i=0;i<24;i++){ const b=document.createElement("span"); b.className="vc-mobile-bar"; b.style.height="6px"; if(cancel) b.style.background="#ed4245"; bars.appendChild(b); }
            row.appendChild(bars);
            mid.appendChild(row);
            overlay.appendChild(mid);
            const btns = document.createElement("div");
            btns.style.cssText = "display:flex;gap:6px;";
            const c = document.createElement("button");
            c.textContent = "Cancel"; c.style.cssText = "padding:4px 8px;border-radius:6px;border:none;background:#ed4245;color:white;cursor:pointer;font-size:12px;";
            c.onclick = () => { cancel=true; stopRecording(true); overlay?.remove(); overlay=null; showToast("Cancelled", Toasts.Type.MESSAGE); };
            btns.appendChild(c);
            if (locked) {
                const s = document.createElement("button"); s.textContent="Send"; s.style.cssText="padding:4px 8px;border-radius:6px;border:none;background:#23a55a;color:white;cursor:pointer;font-size:12px;"; s.onclick=()=>doSend(); btns.appendChild(s);
            } else {
                const l = document.createElement("button"); l.textContent="ðŸ”’ Lock"; l.style.cssText="padding:4px 8px;border-radius:6px;border:none;background:#313338;color:white;cursor:pointer;font-size:12px;"; l.onclick=()=>{locked=true; updateOverlay();}; btns.appendChild(l);
            }
            overlay.appendChild(btns);
        };
        const doSend = () => {
            const b = previewBlob || (chunks.length ? new Blob(chunks, {type:"audio/ogg; codecs=opus"}) : null);
            if (b && b.size>800) sendAudio(b);
            cleanup();
        };
        const cleanup = () => {
            recording=false; locked=false; cancel=false; elapsed=0;
            clearInterval(timer); if(raf) cancelAnimationFrame(raf); if(audioCtx) try{audioCtx.close();}catch{} audioCtx=null; analyser=null;
            stream?.getTracks().forEach((t:any)=>t.stop());
            overlay?.remove(); overlay=null;
            if(previewUrl) URL.revokeObjectURL(previewUrl);
            previewBlob=null; previewUrl=null; recorder=null; stream=null; chunks=[];
        };
        const startRecording = async (e:any) => {
            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            startX=cx; cancel=false; locked=false;
            console.log("[MobileVoice] startRecording", e.type);
            createOverlay();
            // Try native Discord recorder first on desktop (more reliable, gives ogg)
            if (typeof IS_DISCORD_DESKTOP !== "undefined" && (IS_DISCORD_DESKTOP as any) && typeof DiscordNative !== "undefined" && Native) {
                try {
                    const discordVoice = (DiscordNative as any).nativeModules.requireModule("discord_voice");
                    const deviceId = MediaEngineStore.getInputDeviceId();
                    console.log("[MobileVoice] trying native recorder", deviceId);
                    const ok = await new Promise<boolean>(res => discordVoice.startLocalAudioRecording({ echoCancellation: true, noiseCancellation: true, deviceId }, (s:boolean)=>res(s)));
                    if (ok) {
                        console.log("[MobileVoice] native started");
                        recording=true;
                        const start=Date.now();
                        timer=setInterval(()=>{ elapsed=Math.floor((Date.now()-start)/1000); updateOverlay(); },100);
                        (recorder as any) = "native";
                        // Store for stop
                        (window as any)._vcNativeRecorder = { stop: (cb:any) => discordVoice.stopLocalAudioRecording(cb) };
                        return;
                    }
                    console.log("[MobileVoice] native failed, fallback to getUserMedia");
                } catch (err) { console.error("[MobileVoice] native error", err); }
            }
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true } as any);
                console.log("[MobileVoice] got stream", stream);
                try {
                    audioCtx = new (window as any).AudioContext();
                    const src = audioCtx.createMediaStreamSource(stream);
                    analyser = audioCtx.createAnalyser(); analyser.fftSize=256; src.connect(analyser);
                    const data = new Uint8Array(analyser.frequencyBinCount);
                    const tick = () => {
                        if(!analyser || !recording) return;
                        analyser.getByteFrequencyData(data);
                        const barsEl = document.getElementById("vc-live-bars");
                        if(barsEl){
                            const bars=barsEl.children;
                            const step=Math.floor(data.length/bars.length);
                            for(let i=0;i<bars.length;i++){ const v=data[i*step]||0; const h=4+(v/255)*18; (bars[i] as HTMLElement).style.height=h+"px"; }
                        }
                        raf=requestAnimationFrame(tick);
                    }; tick();
                } catch (err) { console.error(err); }
                let mimeType: string | undefined;
                if ((window as any).MediaRecorder?.isTypeSupported?.("audio/ogg; codecs=opus")) mimeType = "audio/ogg; codecs=opus";
                else if ((window as any).MediaRecorder?.isTypeSupported?.("audio/webm;codecs=opus")) mimeType = "audio/webm;codecs=opus";
                else if ((window as any).MediaRecorder?.isTypeSupported?.("audio/webm")) mimeType = "audio/webm";
                else mimeType = undefined;
                console.log("[MobileVoice] using mimeType", mimeType);
                recorder = new (window as any).MediaRecorder(stream, mimeType ? { mimeType } as any : undefined);
                chunks=[];
                recorder.ondataavailable=(ev:any)=>{ if(ev.data.size) chunks.push(ev.data); };
                recorder.onstop=()=>{
                    const blob=new Blob(chunks,{type: mimeType || "audio/ogg; codecs=opus"});
                    if(!cancel && blob.size>800){
                        previewBlob=blob; previewUrl=URL.createObjectURL(blob);
                        if(overlay){
                            overlay.innerHTML="";
                            const play=document.createElement("button"); play.textContent="â–¶"; play.style.cssText="width:32px;height:32px;border-radius:50%;border:none;background:#5865f2;color:white;cursor:pointer;";
                            let audio:any=null, playing=false;
                            play.onclick=()=>{ if(!audio){audio=new Audio(previewUrl!); audio.onended=()=>{playing=false; play.textContent="â–¶";};} if(playing){audio.pause(); playing=false; play.textContent="â–¶";} else {audio.play(); playing=true; play.textContent="â¸";} };
                            overlay.appendChild(play);
                            const info=document.createElement("div"); info.style.cssText="flex:1;font-size:13px;font-weight:600;color:white;"; info.textContent="Preview â€” Tap Send";
                            overlay.appendChild(info);
                            const del=document.createElement("button"); del.textContent="ðŸ—‘"; del.style.cssText="padding:6px 10px;border-radius:6px;border:none;background:#ed4245;color:white;cursor:pointer;"; del.onclick=()=>{ if(previewUrl) URL.revokeObjectURL(previewUrl); previewBlob=null; previewUrl=null; overlay?.remove(); overlay=null; };
                            const send=document.createElement("button"); send.textContent="Send"; send.style.cssText="padding:6px 12px;border-radius:6px;border:none;background:#23a55a;color:white;cursor:pointer;font-weight:700;"; send.onclick=()=>doSend();
                            overlay.appendChild(del); overlay.appendChild(send);
                            return;
                        }
                        sendAudio(blob);
                    }
                    cleanup();
                };
                recorder.start(); recording=true;
                const start=Date.now();
                timer=setInterval(()=>{ elapsed=Math.floor((Date.now()-start)/1000); updateOverlay(); },100);
                console.log("[MobileVoice] recording started");
            } catch (err:any) {
                console.error("[MobileVoice] getUserMedia failed", err);
                showToast("Microphone permission missing â€” Allow mic in Windows + Discord Voice settings. Error: "+ (err.message||err), Toasts.Type.FAILURE);
                overlay?.remove(); overlay=null;
            }
        };
        const stopRecording = (isCancel:boolean) => {
            if(isCancel) cancel=true;
            clearInterval(timer);
            if ((recorder as any) === "native" && typeof DiscordNative !== "undefined") {
                try {
                    const discordVoice = (DiscordNative as any).nativeModules.requireModule("discord_voice");
                    const nativeStop = (window as any)._vcNativeRecorder?.stop || ((cb:any)=>discordVoice.stopLocalAudioRecording(cb));
                    nativeStop(async (filePath: string) => {
                        console.log("[MobileVoice] native stop", filePath);
                        if (!filePath || !Native) { cleanup(); return; }
                        try {
                            const buf = await Native.readRecording(filePath);
                            if (!buf) { showToast("Failed to read recording", Toasts.Type.FAILURE); cleanup(); return; }
                            const blob = new Blob([buf], { type: "audio/ogg; codecs=opus" });
                            if (cancel || blob.size < 800) { cleanup(); return; }
                            previewBlob = blob; previewUrl = URL.createObjectURL(blob);
                            if (overlay) {
                                overlay.innerHTML = "";
                                const play = document.createElement("button"); play.textContent = "▶"; play.style.cssText = "width:32px;height:32px;border-radius:50%;border:none;background:#5865f2;color:white;cursor:pointer;";
                                let audio:any=null, playing=false;
                                play.onclick=()=>{ if(!audio){audio=new Audio(previewUrl!); audio.onended=()=>{playing=false; play.textContent="▶";};} if(playing){audio.pause(); playing=false; play.textContent="▶";} else {audio.play(); playing=true; play.textContent="⏸";} };
                                overlay.appendChild(play);
                                const info=document.createElement("div"); info.style.cssText="flex:1;font-size:13px;font-weight:600;color:white;"; info.textContent="Preview — Tap Send";
                                overlay.appendChild(info);
                                const del=document.createElement("button"); del.textContent="🗑"; del.style.cssText="padding:6px 10px;border-radius:6px;border:none;background:#ed4245;color:white;cursor:pointer;"; del.onclick=()=>{ if(previewUrl) URL.revokeObjectURL(previewUrl); previewBlob=null; previewUrl=null; overlay?.remove(); overlay=null; cleanup(); };
                                const send=document.createElement("button"); send.textContent="Send"; send.style.cssText="padding:6px 12px;border-radius:6px;border:none;background:#23a55a;color:white;cursor:pointer;font-weight:700;"; send.onclick=()=>{ if(previewBlob) sendAudio(previewBlob); if(previewUrl) URL.revokeObjectURL(previewUrl); overlay?.remove(); overlay=null; cleanup(); };
                                overlay.appendChild(del); overlay.appendChild(send);
                                return;
                            }
                            sendAudio(blob); cleanup();
                        } catch (e) { console.error(e); showToast("Failed to read recording", Toasts.Type.FAILURE); cleanup(); }
                    });
                    return;
                } catch (e) { console.error(e); }
            }
            if(recorder && recorder.state==="recording") recorder.stop();
            else cleanup();
        };
        const onMove = (e:any) => {
            if(!recording || locked) return;
            const x = e.touches ? e.touches[0].clientX : e.clientX;
            const y = e.touches ? e.touches[0].clientY : e.clientY;
            const d = startX - x;
            if(d>70) cancel=true; else cancel=false;
            // Slide up to lock like mobile - show lock with dashed line
            if(startY - y > 60) {
                locked=true;
                // Show lock indicator above overlay like mobile
                let lockEl = document.getElementById("vc-mobile-lock");
                if(!lockEl){
                    lockEl=document.createElement("div");
                    lockEl.id="vc-mobile-lock";
                    lockEl.className="vc-mobile-lock";
                    lockEl.innerHTML=`<div style="font-size:18px;">🔒</div><div class="vc-mobile-lock-line"></div><div style="font-size:10px;opacity:0.7;">Swipe up to lock</div>`;
                    document.body.appendChild(lockEl);
                    setTimeout(()=>{ lockEl?.remove(); }, 800);
                }
            }
            updateOverlay();
        };
        const onUp = () => {
            if(!recording && !previewBlob) return;
            if(!locked && recording) stopRecording(cancel);
            window.removeEventListener("mousemove", onMove as any);
            window.removeEventListener("mouseup", onUp);
            window.removeEventListener("touchmove", onMove as any);
            window.removeEventListener("touchend", onUp);
        };
        const injectButton = () => {
            if(document.getElementById("vc-mobile-mic-btn")) return;
            const bar = document.querySelector('[class*="channelTextArea"]') || document.querySelector('form[class*="form"]') || document.querySelector('[class*="scrollableContainer"]') || document.querySelector('div[role="textbox"]')?.closest('form') as any;
            if(!bar) return;
            let container: any = (bar as any).querySelector?.('[class*="buttons"]') || (bar as any).querySelector?.('[class*="inner"]') || bar;
            if(!container) container=bar;
            if(container.querySelector("#vc-mobile-mic-btn")) return;
            console.log("[MobileVoice] Injecting mic button into", container);
            const btn=document.createElement("button");
            btn.id="vc-mobile-mic-btn"; btn.className="vc-mobile-mic"; btn.title="Hold to record â€” Like mobile";
            btn.innerHTML=`<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"/><path d="M17 11a5 5 0 0 1-10 0M12 16v4M8 20h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`;
            btn.onmousedown=(e)=>{ console.log("[MobileVoice] mousedown direct"); e.preventDefault(); startRecording(e); window.addEventListener("mousemove", onMove as any); window.addEventListener("mouseup", onUp); };
            btn.ontouchstart=(e)=>{ console.log("[MobileVoice] touchstart"); startRecording(e); window.addEventListener("touchmove", onMove as any); window.addEventListener("touchend", onUp); };
            const sendBtn=container.querySelector('[class*="sendButton"]');
            try{ if(sendBtn?.parentElement) sendBtn.parentElement.insertBefore(btn, sendBtn); else container.appendChild(btn); }catch{ container.appendChild(btn); }
            console.log("[MobileVoice] Button injected direct DOM!");
        };
        const obs=new MutationObserver(()=>injectButton());
        obs.observe(document.body,{childList:true,subtree:true});
        const interval=setInterval(injectButton,1000);
        injectButton();
        setTimeout(injectButton,500);
        (this as any)._obs=obs; (this as any)._interval=interval; (this as any)._cleanup=cleanup;
        console.log("[MobileVoice] direct DOM plugin started");
    },
    stop() {
        (this as any)._obs?.disconnect();
        clearInterval((this as any)._interval);
        (this as any)._cleanup?.();
        document.getElementById("vc-mobileVoice-style")?.remove();
        document.getElementById("vc-mobile-mic-btn")?.remove();
        document.querySelector(".vc-mobile-overlay")?.remove();
        console.log("[MobileVoice] stopped");
    }
});
