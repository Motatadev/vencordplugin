# UltraCustomRPC — Vencord Plugin

Fully customizable Rich Presence visible to **everyone** — external images, buttons, presets, party & timestamps.

> **Author: Motata** • Vencord userplugin • More complete than built-in CustomRPC

---

## ✨ Features

| Feature | Details |
|---|---|
| **Visible to everyone** | Uses `LOCAL_ACTIVITY_UPDATE` (`socketId: UltraCustomRPC`). Others see it if you have *Activity Sharing* enabled. |
| **Activity types** | Playing, Streaming, Listening, Watching, Competing |
| **Main** | App Name/ID, Details + URL, State + URL, Stream link |
| **Images** | Large/Small image — paste `https://` URL (auto `mp:external` → no app upload needed) or Discord asset key + tooltip + click URL |
| **Buttons** | Up to 2 buttons (text 31 chars + URL) — visible to others (hidden on your own profile by Discord, but others see them) |
| **Party & Timestamps** | Party size/max, timestamp modes: None / Since now / Since day start / Custom |
| **Presets** | Save/load/delete presets via `DataStore`, **Export/Import JSON** to share |
| **Live preview** | What others see, updated live |
| **Toolbox** | `Toggle Ultra RPC` / `Refresh RPC` |

---

## 📦 Installation

### Requirements (Windows)

```powershell
node --version  # >=22
pnpm --version
git --version
```

If missing:
- **Node.js 22+** https://nodejs.org (LTS) → restart
- **Git** https://git-scm.com/download/win
- `npm i -g pnpm` after Node

### 1. Clone Vencord

```powershell
cd C:\Users\%USERNAME%\Downloads
git clone https://github.com/Vendicated/Vencord.git
cd Vencord
```

### 2. Add the plugin

```powershell
Copy-Item -Recurse "C:\path\to\ultraCustomRPC" "src\userplugins\ultraCustomRPC"
# Check: src\userplugins\ultraCustomRPC\index.tsx exists
```

### 3. Build & Patch

```powershell
pnpm i
pnpm build
pnpm inject
# Choose Stable → patches C:\Users\...\AppData\Local\Discord
```

### 4. Enable

Discord → **Settings → Vencord → Plugins** → enable **UltraCustomRPC**.

> Quit Discord fully (tray → Quit) then relaunch after `pnpm inject`.

---

## 🎮 Usage

### Make it visible to everyone

1. Discord → **Settings → Activity Privacy** → enable **Display current activity**
2. Plugin will show a red warning if disabled → click **Enable Activity Sharing**

Without this, only you see the RPC — nobody else will.

### Configure

Settings → Vencord → Plugins → UltraCustomRPC (cog):

- **App Name*** (required) → e.g. `My Game`
- **App ID** → leave `0` for external `https://` images, or paste Discord Application ID (16-21 digits) if you uploaded assets via https://discord.com/developers/applications
- **Activity Type** → select
- **Details / State** (+ optional click URLs)
- **Images** → paste `https://i.imgur.com/...png` (no need to upload elsewhere) or asset key. Add tooltip + click URL if wanted.
- **Buttons** → text + `https://` URL (max 2)
- **Party / Timestamps**

Toggle **RPC Enabled** switch to hide/show instantly. **Refresh RPC** button forces update.

### Presets (shareable)

In settings bottom:

- Name → **Save** → appears as pill
- **Load** → applies preset + updates RPC
- **X** → delete
- **Export** → downloads `ultra-rpc.json`
- **Import** → load someone's JSON

Share the JSON — anyone can import and have your exact RPC.

### Toolbox

Top right Vencord Toolbox:

- **Toggle Ultra RPC** → on/off
- **Refresh RPC**

---

## ⚙️ Files

```
src/userplugins/ultraCustomRPC/index.tsx
  ├─ toExternalImage()     → https:// → mp:external/<b64>
  ├─ createActivityFromStore() → builds Activity (assets, buttons, timestamps, party)
  ├─ setRpc()              → FluxDispatcher LOCAL_ACTIVITY_UPDATE (UltraCustomRPC)
  └─ DataStore             → ultraCustomRPC_presets, ultraCustomRPC_active
```

---

## 🔧 Troubleshooting

| Issue | Fix |
|---|---|
| Others can't see my RPC | Enable **Display current activity** in Discord settings. Plugin shows warning if off. |
| Buttons not visible on my profile | Normal — Discord hides buttons on your own profile. Others see them. Check with alt account or friend. |
| Image not showing | Use direct `https://i.imgur.com/...png` (right-click → Copy image address). For Discord asset keys, upload in Developer Portal → Rich Presence → Art Assets. |
| Build fail | `import * as DataStore` not `{ DataStore }`. Ensure Node >=22, `pnpm i` done. |
| `git rev-parse` fail | `git init; git remote add origin https://github.com/Vendicated/Vencord.git; git commit -m "init"` then `pnpm build` |
| RPC not updating | Click **Refresh RPC** or toggle Enabled off/on. Check App Name is not empty. |

**Debug:** `Ctrl+Shift+I` → Console → `UltraCustomRPC` errors.

---

## 🗑️ Uninstall

```powershell
# Discord: disable UltraCustomRPC → restart
# Or remove:
Remove-Item -Recurse -Force src\userplugins\ultraCustomRPC
pnpm build; pnpm inject
```

---

## 📄 License

GPL-3.0 (like Vencord) • Plugin by Motata

Need help? Open an issue with your preset JSON + screenshot.
