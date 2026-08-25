# CustomDMIcon — Plugin Vencord

Triple-clic sur le bouton **Messages Privés** pour changer l'icône Discord, l'arrière-plan et tous les logos Discord — avec interface, galeries sauvegardées et réglages de transparence.

> **Auteur : Motata** • Plugin userplugin Vencord • Compatible tous thèmes (midnight, etc.)

---

## ✨ Fonctionnalités

| Onglet | Ce que ça fait |
|---|---|
| **🎨 Icône MPs** | Remplace le logo Discord en haut à gauche (bouton Home) par n'importe quelle image (URL ou fichier). Galerie sauvegardée. |
| **🖼️ Fond** | Image d'arrière-plan plein écran derrière Discord. Sliders : opacité image, transparence panels, flou, luminosité. S'adapte à tous les thèmes via `color-mix`. |
| **💠 Logo Discord** | Remplace **tous** les logos Discord in-app (splash au lancement, écrans de chargement, onboarding) par ton image. Animation `pulse` gardée. Supporte GIF animé. |

**Bonus :**
- Ouverture par **triple-clic** sur le bouton Home (`[data-list-item-id="guildsnav___home"]`) en <600ms
- Aussi dispo dans **Toolbox Vencord** → `Changer icône / Fond`
- Le GUI de réglage reste **100% opaque** (jamais transparent)
- Galeries `DataStore` (IndexedDB) → persiste après redémarrage
- Icône du raccourci Bureau changeable en `.ico` (voir section Bureau)

---

## 📦 Installation

### Pré-requis (Windows)

```powershell
# Vérifie
node --version  # besoin >=22
pnpm --version
git --version
```

Si manquant :

- **Node.js 22+** : https://nodejs.org (LTS) → redémarre après install
- **Git** : https://git-scm.com/download/win
- **pnpm** : après Node,
```powershell
npm i -g pnpm
```

### 1. Cloner Vencord

```powershell
cd C:\Users\%USERNAME%\Downloads
git clone https://github.com/Vendicated/Vencord.git
cd Vencord
```

### 2. Ajouter le plugin

Copie le dossier `customDMIcon` de ce repo :

```powershell
Copy-Item -Recurse "C:\chemin\vers\customDMIcon" "src\userplugins\customDMIcon"
# Vérifie : src\userplugins\customDMIcon\index.tsx existe
```

### 3. Build & Patch

```powershell
pnpm i
pnpm build
pnpm inject
# Choisis "Stable" → patch C:\Users\...\AppData\Local\Discord
```

### 4. Activer

Lance Discord → **Paramètres → Vencord → Plugins** → active **CustomDMIcon** (activé par défaut).

> Le Discord doit être **Quitté complètement** (icône barre des tâches → Quitter) puis relancé après `pnpm inject`.

---

## 🎮 Utilisation

### Ouvrir l'interface
- **Triple-clic rapide** sur le rond du haut (logo Discord / Messages Privés)
- Ou **Toolbox** (icône Vencord en haut à droite) → `Changer icône / Fond`

### 🎨 Icône MPs
1. Colle une **URL** (`https://i.imgur.com/...png`) OU glisse une image / clique la zone pointillée (PNG/JPG/GIF/WEBP → converti en base64)
2. **Appliquer** → remplace instantanément
3. **Sauvegarder dans la galerie** → retrouve-la en bas → **Charger** pour réutiliser
4. **Réinitialiser** → remet le logo Discord

### 🖼️ Arrière-plan
1. URL ou glisser image
2. Règle les sliders (live preview) :
   - **Opacité image** 0-100% (35% recommandé)
   - **Transparence panels** 20-100% (75% = semi-transparent, s'adapte au thème via `color-mix`)
   - **Flou** 0-20px
   - **Luminosité** 50-130%
3. **Appliquer fond** → `body::before` + panels color-mix
4. **Supprimer fond** → retire tout

> Adaptatif : marche avec **midnight, autres thèmes** sans casser les couleurs (pas de `hsla` fixe).

### 💠 Logo Discord Global
1. URL ou glisser image (ton icône MPs en 1 clic : **Utiliser l'icône MPs**)
2. **Appliquer logo** → tous les logos Discord in-app (splash de lancement) deviennent ton image avec animation `vc-discord-pulse` gardée. Supporte **GIF animé**.
3. **Réinitialiser** → logos d'origine

---

## 🖥️ Changer l'icône du Bureau

L'icône du raccourci Windows n'est pas dans Discord. Pour la changer :

**Auto (PowerShell) :**
```powershell
# 1. Convertis ton image en .ico (en ligne : https://icoconvert.com ou via script)
# 2. Patch le raccourci :
$wsh = New-Object -COM WScript.Shell
$lnk = $wsh.CreateShortcut("$env:USERPROFILE\Desktop\Discord.lnk")
$lnk.IconLocation = "C:\chemin\vers\ton-logo.ico"
$lnk.Save()
# Épingle à la barre des tâches : clic droit raccourci → Épingler
```

Dis-moi ton image et je te génère le `.ico` + commande exacte.

---

## ⚙️ Fichiers

```
src/userplugins/customDMIcon/index.tsx
  ├─ applyIcon()               → style #vc-customDMIcon-style (Home button)
  ├─ applyBackground()         → style #vc-customBG-style (body::before + color-mix panels)
  ├─ applyGlobalDiscordLogo()  → style #vc-discordLogo-style (tous les logos + splash animé)
  ├─ DataStore keys            → customDMIcon_current, _saved, _bgUrl, _bgSettings, _discordLogo
  └─ triple-click handler      → document.addEventListener("click", ..., true) sur [data-list-item-id="guildsnav___home"]
```

---

## 🔧 Dépannage

| Problème | Solution |
|---|---|
| Triple-clic ouvre rien (fond sombre vide avant fix) | Ancien `ModalRoot` → maintenant `Modal` natif. Rebuild : `pnpm build` + `pnpm inject` + **redémarre Discord (Quitter)** |
| Transparence ne bouge pas | C'était boucle `color-mix(self)`. Maintenant conteneurs ciblés direct. Rebuild avec la version adaptative. |
| Tout bug avec un autre thème | Mode adaptatif `color-mix` avec `var(--background-primary, var(--bg-2))`. Si bug persiste → donne le nom du thème |
| Modal transparent | Fix : `[class*="modal_"] { opacity:1 !important }` → GUI toujours opaque |
| Build fail `No matching export DataStore` | `import * as DataStore from "@api/DataStore"` (pas `{ DataStore }`) |
| `git rev-parse` fail | `git init; git remote add origin https://github.com/Vendicated/Vencord.git; git commit -m "init"` puis `pnpm build` |
| Image s'affiche pas | URL doit être directe (finit .png/.webp) ou upload fichier (base64). Teste dans navigateur d'abord. |

**Debug :** `Ctrl+Shift+I` → Console → filtre `CustomDMIcon` → envoie l'erreur rouge.

---

## 🗑️ Désinstallation

```powershell
# Dans Discord : désactive CustomDMIcon → redémarre
# Ou retire le dossier :
Remove-Item -Recurse -Force src\userplugins\customDMIcon
pnpm build; pnpm inject
# Pour dépatcher Discord :
pnpm uninject
```

Supprime aussi les styles si besoin (devtools) :
```js
document.getElementById("vc-customDMIcon-style")?.remove()
document.getElementById("vc-customBG-style")?.remove()
document.getElementById("vc-discordLogo-style")?.remove()
```

---

## 📝 Custom rapide sans plugin (CSS seul)

Si tu veux juste une icône fixe sans interface, colle dans **Vencord → Custom CSS** :

```css
div[data-list-item-id="guildsnav___home"] [class*="childWrapper"] > svg { display: none !important; }
div[data-list-item-id="guildsnav___home"] [class*="childWrapper"] {
  background-image: url('https://i.imgur.com/TON_IMAGE.png') !important;
  background-size: cover !important;
  background-position: center !important;
}
```

---

## 📄 Licence

GPL-3.0 (comme Vencord) • Plugin perso pour Motata

> Besoin d'aide ? Ouvre une issue avec ton image + thème utilisé.
