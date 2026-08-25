# Plugin CustomDMIcon - Triple-clic icône Messages Privés

## C'est quoi ?
Un plugin Vencord qui te permet de **changer l'icône des Messages Privés** (le logo Discord en haut à gauche) par n'importe quelle image.

- **Triple-clic** sur le bouton Home/MPs → ouvre l'interface
- Tu peux coller une **URL** ou **uploader un fichier** (glisser-déposer)
- **Galerie sauvegardée** : toutes tes icônes précédentes restent en mémoire
- Bouton **Réinitialiser** pour remettre le logo Discord

---

## Installation étape par étape (Windows)

### 1. Pré-requis
Tu n'as pas encore git/node, donc installe-les :

1. Installe **Git** : https://git-scm.com/download/win → Next → Next
2. Installe **Node.js 20 LTS** : https://nodejs.org/ → redémarre le PC après
3. Vérifie dans PowerShell :
```powershell
git --version
node --version
npm --version
```

### 2. Cloner Vencord
```powershell
cd C:\Users\Motata\Downloads
git clone https://github.com/Vendicated/Vencord.git
cd Vencord
```

### 3. Installer le plugin
Copie le dossier `customDMIcon` que je viens de créer :

```powershell
Copy-Item -Recurse "C:\Users\Motata\Downloads\vencord ciutsom\customDMIcon" "src\userplugins\customDMIcon"
```

Vérifie que tu as bien `src\userplugins\customDMIcon\index.tsx`

### 4. Build & Patch
```powershell
npm i -g pnpm
pnpm i
pnpm build
pnpm inject
```
Choisis ta branche Discord (Stable) → ça patch Discord.

### 5. Utiliser
1. Lance Discord → Paramètres → Vencord → Plugins → active **CustomDMIcon**
2. **Triple-clic** rapidement sur le bouton Messages Privés en haut à gauche (le logo Discord)
3. L'interface s'ouvre :
   - Colle une URL (ex: `https://i.imgur.com/xxx.png`)
   - OU clique sur la zone pointillée / glisse une image
   - Clique **Appliquer**
   - Clique **Sauvegarder dans la galerie** pour la garder
4. Tes icônes sauvegardées apparaissent en dessous → clique **Charger** pour réutiliser

Astuce : le plugin est aussi dans **Toolbox** (en haut à droite) → "Changer icône MPs" si tu veux l'ouvrir sans triple-clic.

### Alternative sans rebuild (CSS rapide)
Si tu veux juste une icône fixe sans interface, mets ça dans `Paramètres Vencord → Vencord → Custom CSS` :

```css
div[data-list-item-id="guildsnav___home"] [class*="childWrapper"] > svg { display: none !important; }
div[data-list-item-id="guildsnav___home"] [class*="childWrapper"] {
  background-image: url('https://i.imgur.com/TA_IMAGE.png') !important;
  background-size: cover !important;
  background-position: center !important;
}
```

---

## Dépannage
- **Triple-clic marche pas** → clique bien 3 fois vite (<600ms) exactement sur le rond du haut. Vérifie que le plugin est bien activé (pas besoin de restart).
- **Image s'affiche pas** → vérifie que l'URL est directe (finit par .png/.jpg/.webp) ou utilise l'upload fichier qui convertit en base64.
- **Après maj Discord** → refais `pnpm inject` dans le dossier Vencord.

Besoin d'aide ? Envoie-moi ta nouvelle icône et je te fais un thème midnight avec direct.
