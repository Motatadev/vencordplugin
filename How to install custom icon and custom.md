# CustomDMIcon — Vencord Plugin

Triple-click the **Direct Messages** button to change the Discord icon, background and all Discord logos — with UI, saved galleries and transparency controls.

> **Author: Motata** • Vencord userplugin • Compatible with all themes (midnight, etc.)

---

## ✨ Features

| Tab | What it does |
|---|---|
| **🎨 DM Icon** | Replaces the Discord logo at the top left (Home button) with any image (URL or file). Saved gallery. |
| **🖼️ Background** | Fullscreen background image behind Discord. Sliders: image opacity, panel transparency, blur, brightness. Adapts to all themes via `color-mix`. |
| **💠 Discord Logo** | Replaces **all** in-app Discord logos (launch splash, loading screens, onboarding) with your image. Keeps `pulse` animation. Supports animated GIF. |

**Bonus:**
- Open by **triple-click** on Home button (`[data-list-item-id="guildsnav___home"]`) within <600ms
- Also available in **Vencord Toolbox** → `Change icon / Background`
- Settings GUI stays **100% opaque** (never transparent)
- Galleries via `DataStore` (IndexedDB) → persists after restart
- Desktop shortcut icon changeable to `.ico` (see Desktop section)

---

## 📦 Installation

### Requirements (Windows)

```powershell
# Check
node --version  # need >=22
pnpm --version
git --version
```

If missing:

- **Node.js 22+**: https://nodejs.org (LTS) → restart after install
- **Git**: https://git-scm.com/download/win
- **pnpm**: after Node,
```powershell
npm i -g pnpm
```

### 1. Clone Vencord

```powershell
cd C:\Users\%USERNAME%\Downloads
git clone https://github.com/Vendicated/Vencord.git
cd Vencord
```

### 2. Add the plugin

Copy the `customDMIcon` folder from this repo:

```powershell
Copy-Item -Recurse "C:\path\to\customDMIcon" "src\userplugins\customDMIcon"
# Check: src\userplugins\customDMIcon\index.tsx exists
```

### 3. Build & Patch

```powershell
pnpm i
pnpm build
pnpm inject
# Choose "Stable" → patches C:\Users\...\AppData\Local\Discord
```

### 4. Enable

Launch Discord → **Settings → Vencord → Plugins** → enable **CustomDMIcon** (enabled by default).

> Discord must be **fully quit** (system tray → Quit) then relaunched after `pnpm inject`.

---

## 🎮 Usage

### Open the UI
- **Triple-click** the top circle (Discord logo / Direct Messages)
- Or **Toolbox** (Vencord icon top right) → `Change icon / Background`

### 🎨 DM Icon
1. Paste an **URL** (`https://i.imgur.com/...png`) OR drag an image / click the dashed zone (PNG/JPG/GIF/WEBP → converted to base64)
2. **Apply** → instantly replaced
3. **Save to gallery** → find it at the bottom → **Load** to reuse
4. **Reset** → back to Discord logo

### 🖼️ Background
1. URL or drag image
2. Adjust sliders (live preview):
   - **Image opacity** 0-100% (35% recommended)
   - **Panel transparency** 20-100% (75% = semi-transparent, adapts to theme via `color-mix`)
   - **Blur** 0-20px
   - **Brightness** 50-130%
3. **Apply background** → `body::before` + color-mix panels
4. **Remove background** → clears all

> Adaptive: works with **midnight and other themes** without breaking colors (no fixed `hsla`).

### 💠 Global Discord Logo
1. URL or drag image (1-click use DM icon: **Use DM icon**)
2. **Apply logo** → all in-app Discord logos (launch splash) become your image with `vc-discord-pulse` animation kept. Supports **animated GIF**.
3. **Reset** → original logos

---

## 🖥️ Change Desktop Icon

Windows shortcut icon is not inside Discord. To change it:

**Auto (PowerShell):**
```powershell
# 1. Convert your image to .ico (online: https://icoconvert.com or via script)
# 2. Patch the shortcut:
$wsh = New-Object -COM WScript.Shell
$lnk = $wsh.CreateShortcut("$env:USERPROFILE\Desktop\Discord.lnk")
$lnk.IconLocation = "C:\path\to\your-logo.ico"
$lnk.Save()
# Pin to taskbar: right-click shortcut → Pin
```

Send me your image and I’ll generate the `.ico` + exact command.

---

## ⚙️ Files

```
src/userplugins/customDMIcon/index.tsx
  ├─ applyIcon()               → style #vc-customDMIcon-style (Home button)
  ├─ applyBackground()         → style #vc-customBG-style (body::before + color-mix panels)
  ├─ applyGlobalDiscordLogo()  → style #vc-discordLogo-style (all logos + animated splash)
  ├─ DataStore keys            → customDMIcon_current, _saved, _bgUrl, _bgSettings, _discordLogo
  └─ triple-click handler      → document.addEventListener("click", ..., true) on [data-list-item-id="guildsnav___home"]
```

---

## 🔧 Troubleshooting

| Issue | Fix |
|---|---|
| Triple-click does nothing (dark overlay before fix) | Old `ModalRoot` → now native `Modal`. Rebuild: `pnpm build` + `pnpm inject` + **restart Discord (Quit)** |
| Transparency slider does nothing | Was `color-mix(self)` loop. Now containers targeted directly. Rebuild with adaptive version. |
| Breaks with another theme | Adaptive `color-mix` with `var(--background-primary, var(--bg-2))`. If still broken → tell me theme name |
| Modal transparent | Fix: `[class*="modal_"] { opacity:1 !important }` → GUI always opaque |
| Build fail `No matching export DataStore` | `import * as DataStore from "@api/DataStore"` (not `{ DataStore }`) |
| `git rev-parse` fail | `git init; git remote add origin https://github.com/Vendicated/Vencord.git; git commit -m "init"` then `pnpm build` |
| Image not showing | URL must be direct (ends .png/.webp) or file upload (base64). Test in browser first. |

**Debug:** `Ctrl+Shift+I` → Console → filter `CustomDMIcon` → send red error.

---

## 🗑️ Uninstall

```powershell
# In Discord: disable CustomDMIcon → restart
# Or remove folder:
Remove-Item -Recurse -Force src\userplugins\customDMIcon
pnpm build; pnpm inject
# To unpatch Discord:
pnpm uninject
```

Also remove styles if needed (devtools):
```js
document.getElementById("vc-customDMIcon-style")?.remove()
document.getElementById("vc-customBG-style")?.remove()
document.getElementById("vc-discordLogo-style")?.remove()
```

---

## 📝 Quick custom without plugin (CSS only)

If you just want a fixed icon without UI, paste in **Vencord → Custom CSS**:

```css
div[data-list-item-id="guildsnav___home"] [class*="childWrapper"] > svg { display: none !important; }
div[data-list-item-id="guildsnav___home"] [class*="childWrapper"] {
  background-image: url('https://i.imgur.com/YOUR_IMAGE.png') !important;
  background-size: cover !important;
  background-position: center !important;
}
```

---

## 📄 License

• Personal plugin by Motata

> Need help? Open an issue with your image + theme used.
