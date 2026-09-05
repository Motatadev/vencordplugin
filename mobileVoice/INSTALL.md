# MobileVoice — Vencord Plugin

Voice messages exactly like **mobile** — hold the mic in the chat bar to record, slide to cancel, lock to continue. No right-click menu.

> **Author: Motata** • Vencord userplugin

---

## ✨ Features

| Feature | Like mobile |
|---|---|
| **Mic button in chat bar** | Always visible next to the input (not hidden in right-click) |
| **Hold to record** | Press & hold mic → recording starts instantly |
| **Slide to cancel** | Drag left >80px → turns red → release to cancel |
| **Lock** | Click 🔒 Lock to keep recording without holding |
| **Live UI** | Red dot pulse, timer `00:00`, waveform bar, "Slide to cancel" text |
| **Send** | Release to send (or Send button when locked) → `voice-message.ogg` with waveform/duration, visible to everyone |
| **Cancel** | Red Cancel button or slide + release |

Works in DMs and servers where you have `SEND_VOICE_MESSAGES` permission.

---

## 📦 Installation

```powershell
# Requirements: Node >=22, pnpm, git
cd C:\Users\%USERNAME%\Downloads
git clone https://github.com/Vendicated/Vencord.git
cd Vencord
Copy-Item -Recurse "C:\path\to\mobileVoice" "src\userplugins\mobileVoice"
pnpm i
pnpm build
pnpm inject
# Choose Stable
```

Enable: Discord → **Settings → Vencord → Plugins** → **MobileVoice**.

> Quit Discord fully then relaunch.

---

## 🎮 Usage

1. Go to any DM / channel
2. **Hold** the 🎙️ mic button in the chat bar
3. Overlay appears above the input:
   - `● Recording... Slide left to cancel` + timer
   - Drag mouse left → `↩ Slide to cancel` (red)
   - Click **🔒 Lock** to keep recording without holding
4. **Release** to send, or **Cancel** to discard
5. When locked, click **Send** (green) to send

Audio is sent as `voice-message.ogg` (Opus) with waveform — playable on desktop & mobile, just like native mobile voice messages.

---

## 🔧 Troubleshooting

| Issue | Fix |
|---|---|
| Mic button not showing | Check channel permissions: need `Send Messages` + `Send Voice Messages` |
| Permission denied | Allow microphone in Windows + Discord (browser prompt) |
| Not sending | Ensure recording >1s. Check console `Ctrl+Shift+I` for errors |
| Build fail | `pnpm i` again, Node >=22 |

---

## 🗑️ Uninstall

```powershell
Remove-Item -Recurse -Force src\userplugins\mobileVoice
pnpm build; pnpm inject
```

---

## 📄 License

GPL-3.0
