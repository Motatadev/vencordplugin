# CustomRPC2 — Vencord Plugin

Fully customizable Rich Presence visible to **everyone** — with a real editor UI, external images, buttons, presets, party & timestamps.

> **Author: Motata** • Vencord userplugin

---

## ✨ Features

| Feature | Details |
|---|---|
| **Visible to everyone** | Uses `LOCAL_ACTIVITY_UPDATE` (`socketId: CustomRPC2`). Others see it if you have *Activity Sharing* enabled. |
| **Real interface** | Open via Toolbox → `Open CustomRPC2` → modal with tabs: Main / Images / Buttons / Time/Party / Presets + live preview |
| **Activity types** | Playing, Streaming, Listening, Watching, Competing |
| **Main** | App Name/ID, Details + URL, State + URL, Stream link |
| **Images** | Large/Small — paste `https://` URL (auto `mp:external` → no app upload) or Discord asset key + tooltip + click URL |
| **Buttons** | Up to 2 buttons (text + URL) — visible to others |
| **Party & Timestamps** | Party size/max, timestamp modes: None / Since now / Since day start |
| **Presets** | Save/load/delete, **Export/Import JSON** to share |

---

## 📦 Installation

```powershell
# Requirements: Node >=22, pnpm, git
cd C:\Users\%USERNAME%\Downloads
git clone https://github.com/Vendicated/Vencord.git
cd Vencord
Copy-Item -Recurse "C:\path\to\CustomRPC2" "src\userplugins\CustomRPC2"
pnpm i
pnpm build
pnpm inject
# Choose Stable
```

Enable: Discord → **Settings → Vencord → Plugins** → **CustomRPC2**.

> Quit Discord fully then relaunch.

---

## 🎮 Usage

### Make it visible to everyone

Discord → **Settings → Activity Privacy** → enable **Display current activity**.  
If disabled, the plugin shows a red warning.

### Open the real editor

- **Toolbox** (Vencord icon top right) → **Open CustomRPC2** → modal
- Or Settings → CustomRPC2 → Use panel (same fields)

**Modal tabs:**
- **Main** → App Name*, App ID, Type, Details/State + URLs
- **Images** → Large/Small image (URL or key), tooltip, click URL
- **Buttons** → Button 1/2 text + URL
- **Time/Party** → Party size, timestamps
- **Presets** → Save current, Load, Export/Import JSON

Click **Save & Apply** → RPC updates instantly. Others see it exactly as in preview (buttons hidden on your own profile, visible to others).

---

## 🔧 Troubleshooting

| Issue | Fix |
|---|---|
| Others can't see it | Enable Activity Sharing in Discord settings |
| Image not showing | Use direct `https://i.imgur.com/...png` (Copy image address) |
| Buttons not visible to me | Normal — visible to others only |
| Build fail | `import * as DataStore` |

---

## 🗑️ Uninstall

```powershell
Remove-Item -Recurse -Force src\userplugins\CustomRPC2
pnpm build; pnpm inject
```

---

## 📄 License

GPL-3.0
