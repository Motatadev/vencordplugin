# vencordplugin — Motata's Vencord Plugins

Collection of my custom [Vencord](https://github.com/Vendicated/Vencord) userplugins — with install guides and customization tutorials.

> **Author: Motata** • https://github.com/Motatadev

---

## 📦 Plugins

| Plugin | Description | Folder |
|---|---|---|
| **CustomDMIcon** | Triple-click the DM Home button to change its icon, set a fullscreen background with transparency/blur controls, and replace all Discord logos (launch splash) while keeping animation. Saved galleries, adaptive to all themes. | [`customDMIcon/`](./customDMIcon/) |

More plugins coming soon...

---

## 📥 Installation

### Requirements (Windows)

```powershell
node --version  # >=22
pnpm --version
git --version
```

Install missing:
- **Node.js 22+** https://nodejs.org (LTS)
- **Git** https://git-scm.com/download/win
- `npm i -g pnpm` after Node

### Add a plugin

```powershell
# 1. Clone Vencord
cd C:\Users\%USERNAME%\Downloads
git clone https://github.com/Vendicated/Vencord.git
cd Vencord

# 2. Copy the plugin you want (example: CustomDMIcon)
Copy-Item -Recurse "C:\path\to\vencordplugin\customDMIcon" "src\userplugins\customDMIcon"

# 3. Build & Patch
pnpm i
pnpm build
pnpm inject
# Choose Stable
```

Then Discord → **Settings → Vencord → Plugins** → enable the plugin.

> Quit Discord fully (tray → Quit) and relaunch after `pnpm inject`.

Each plugin has its own `INSTALL.md` with details — see `customDMIcon/INSTALL.md`.

---

## 🎨 CustomDMIcon — Quick Start

- **Open:** Triple-click the top-left Home / DM button (<600ms) or Toolbox → `Change icon / Background`
- **DM Icon tab:** Paste URL or drag image → Apply / Save to gallery
- **Background tab:** URL/drag → sliders: image opacity, panel transparency, blur, brightness → Apply
- **Discord Logo tab:** Replaces all in-app Discord logos + animated splash (pulse kept, GIF supported)

Full guide: [`customDMIcon/INSTALL.md`](./customDMIcon/INSTALL.md)

---

## 🛠️ Development

```powershell
# After editing a plugin
pnpm build
pnpm inject
# Restart Discord
```

---

## 📄 License

GPL-3.0 (like Vencord)

Questions? Open an issue with your theme + image.
