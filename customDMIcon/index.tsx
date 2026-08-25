import * as DataStore from "@api/DataStore";
import definePlugin from "@utils/types";
import { Button, Forms, Modal, openModal, React, TextInput, useEffect, useState } from "@webpack/common";
import { Flex } from "@components/Flex";
import { Devs } from "@utils/constants";

const DATA_CURRENT = "customDMIcon_current";
const DATA_SAVED = "customDMIcon_saved";
const STYLE_ID = "vc-customDMIcon-style";

// BG keys
const DATA_BG = "customDMIcon_bgUrl";
const DATA_BG_SETTINGS = "customDMIcon_bgSettings";
const STYLE_BG_ID = "vc-customBG-style";

// Global Discord logo (tous les logos + splash animé)
const DATA_DISCORD_LOGO = "customDMIcon_discordLogo";
const STYLE_DISCORD_LOGO_ID = "vc-discordLogo-style";

interface SavedIcon {
    id: string;
    url: string;
    name: string;
}
interface BgSettings {
    opacity: number; // 0-100 -> opacité du fond (image)
    panelOpacity: number; // 0-100 -> transparence des panels Discord
    blur: number; // 0-20px
    brightness: number; // 50-130
}

const DEFAULT_BG_SETTINGS: BgSettings = { opacity: 35, panelOpacity: 75, blur: 0, brightness: 100 };

// --- GLOBAL DISCORD LOGOS (bureau in-app + splash animé) ---
function applyGlobalDiscordLogo(url: string | null) {
    let style = document.getElementById(STYLE_DISCORD_LOGO_ID) as HTMLStyleElement | null;
    if (!url) { if (style) style.remove(); return; }
    if (!style) { style = document.createElement("style"); style.id = STYLE_DISCORD_LOGO_ID; document.head.appendChild(style); }
    style.textContent = `
        /* Tous les SVG logo Discord cachés */
        svg[class*="logo_"], svg[name="Discord"], div[class*="logo_"] svg, [class*="splash_"] svg {
            display: none !important;
        }
        /* Splash / loading screen - on garde l'animation */
        div[class*="splash_"], div[class*="wrapper_"][class*="splash_"], [class*="loading_"] [class*="logo_"] {
            background-image: url("${url.replace(/"/g, '\\"')}") !important;
            background-size: contain !important;
            background-position: center !important;
            background-repeat: no-repeat !important;
            animation: vc-discord-pulse 1.8s ease-in-out infinite !important;
        }
        /* Tout autre endroit où logo apparaît (onboarding, erreurs) */
        [class*="logoContainer_"] {
            background-image: url("${url.replace(/"/g, '\\"')}") !important;
            background-size: contain !important;
            background-position: center !important;
            background-repeat: no-repeat !important;
        }
        @keyframes vc-discord-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.06); opacity: 0.95; } }
        @keyframes vc-discord-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `;
}

// --- ICON (bouton Home) ---
function applyIcon(url: string | null) {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!url) {
        if (style) style.remove();
        return;
    }
    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.appendChild(style);
    }
    style.textContent = `
        div[data-list-item-id="guildsnav___home"] [class*="childWrapper"] > svg,
        div[data-list-item-id="guildsnav___home"] [class*="childWrapper"] > div > svg {
            display: none !important;
        }
        div[data-list-item-id="guildsnav___home"] [class*="childWrapper"] {
            background-image: url("${url.replace(/"/g, '\\"')}") !important;
            background-size: cover !important;
            background-position: center !important;
            background-repeat: no-repeat !important;
            background-color: transparent !important;
            border-radius: 18px !important;
        }
        div[data-list-item-id="guildsnav___home"]:hover [class*="childWrapper"] {
            border-radius: 14px !important;
        }
    `;
}

// --- BACKGROUND --- ADAPTATIF A TOUS LES THEMES / MODAL TOUJOURS OPAQUE ---
function applyBackground(url: string | null, s: BgSettings) {
    let style = document.getElementById(STYLE_BG_ID) as HTMLStyleElement | null;
    if (!url) {
        if (style) style.remove();
        return;
    }
    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_BG_ID;
        document.head.appendChild(style);
    }
    const opacity = s.opacity / 100;
    const p = s.panelOpacity / 100;
    const pPercent = Math.round(p * 100);
    // On NE touche PAS aux variables :root (évite boucle color-mix), on cible direct les conteneurs
    style.textContent = `
        body::before {
            content: "";
            position: fixed;
            inset: 0;
            z-index: -1;
            background-image: url("${url.replace(/"/g, '\\"')}");
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            opacity: ${opacity};
            filter: blur(${s.blur}px) brightness(${s.brightness}%);
            pointer-events: none;
        }
        html, body, #app-mount {
            background: transparent !important;
        }
        /* Panels Discord - adaptatif : mix de la couleur du thème avec transparent */
        /* Discord natif */
        nav[class*="guilds_"] {
            background: color-mix(in srgb, var(--background-tertiary) ${pPercent}%, transparent) !important;
        }
        div[class*="sidebar_"], div[class*="privateChannels_"], div[class*="panels_"], section[class*="panels_"] {
            background: color-mix(in srgb, var(--background-secondary) ${pPercent}%, transparent) !important;
        }
        div[class*="chat_"], main[class*="chatContent_"], div[class*="content_"] {
            background: color-mix(in srgb, var(--background-primary) ${pPercent}%, transparent) !important;
        }
        div[class*="members_"], div[class*="membersWrap_"], div[class*="nowPlayingColumn_"] {
            background: color-mix(in srgb, var(--background-secondary) ${pPercent}%, transparent) !important;
        }
        div[class*="container_"][class*="members_"] {
            background: color-mix(in srgb, var(--background-secondary) ${pPercent}%, transparent) !important;
        }
        /* Midnight compat - si thème midnight actif, ces vars existent et écrasent au-dessus */
        nav[class*="guilds_"] {
            background: color-mix(in srgb, var(--bg-3, var(--background-tertiary)) ${pPercent}%, transparent) !important;
        }
        div[class*="sidebar_"], div[class*="privateChannels_"] {
            background: color-mix(in srgb, var(--bg-2, var(--background-secondary)) ${pPercent}%, transparent) !important;
        }
        div[class*="chat_"], main[class*="chatContent_"] {
            background: color-mix(in srgb, var(--bg-1, var(--background-primary)) ${pPercent}%, transparent) !important;
        }
        [class*="app_"], [class*="bg__"] { background: transparent !important; }

        /* === LE GUI DE REGLAGE (MODAL) RESTE 100% OPAQUE, JAMAIS TRANSPARENT === */
        [class*="modal_"], [class*="root_"][role="dialog"], div[class*="layer_"] [class*="modal_"],
        [class*="content_"][class*="modal_"], div[data-mana-component="modal"] {
            background: var(--background-primary, #313338) !important;
            background-color: var(--background-primary, #313338) !important;
            opacity: 1 !important;
            backdrop-filter: none !important;
        }
        /* Empêche que color-mix n'affecte le modal */
        [class*="modal_"] * { backdrop-filter: none !important; }
    `;
}

async function loadCurrent() {
    const url = await DataStore.get(DATA_CURRENT) as string | undefined;
    if (url) applyIcon(url);
    const bgUrl = await DataStore.get(DATA_BG) as string | undefined;
    const bgSet = (await DataStore.get(DATA_BG_SETTINGS) as BgSettings | undefined) ?? DEFAULT_BG_SETTINGS;
    if (bgUrl) applyBackground(bgUrl, bgSet);
    const discordLogo = await DataStore.get(DATA_DISCORD_LOGO) as string | undefined;
    if (discordLogo) applyGlobalDiscordLogo(discordLogo);
}

function IconModal({ modalProps }: { modalProps: any }) {
    const [tab, setTab] = useState<"icon" | "bg" | "discord">("icon");

    // Icon state
    const [inputUrl, setInputUrl] = useState("");
    const [currentUrl, setCurrentUrl] = useState<string | null>(null);
    const [saved, setSaved] = useState<SavedIcon[]>([]);
    const [dragOver, setDragOver] = useState(false);

    // BG state
    const [bgUrl, setBgUrl] = useState("");
    const [bgSaved, setBgSaved] = useState<SavedIcon[]>([]);
    const [bgSettings, setBgSettings] = useState<BgSettings>(DEFAULT_BG_SETTINGS);
    const [bgDragOver, setBgDragOver] = useState(false);

    // Discord logo global state
    const [discordUrl, setDiscordUrl] = useState("");
    const [discordDragOver, setDiscordDragOver] = useState(false);

    useEffect(() => {
        DataStore.get(DATA_CURRENT).then(v => { if (v) { setCurrentUrl(v as string); setInputUrl(v as string); } });
        DataStore.get(DATA_SAVED).then(v => { if (Array.isArray(v)) setSaved(v as SavedIcon[]); });
        DataStore.get(DATA_BG).then(v => { if (v) setBgUrl(v as string); });
        DataStore.get(DATA_BG_SETTINGS).then(v => { if (v) setBgSettings(v as BgSettings); });
        DataStore.get("customDMIcon_bgSaved").then(v => { if (Array.isArray(v)) setBgSaved(v as SavedIcon[]); });
        DataStore.get(DATA_DISCORD_LOGO).then(v => { if (v) setDiscordUrl(v as string); });
    }, []);

    // live preview for bg when sliders change
    useEffect(() => {
        if (bgUrl.trim()) applyBackground(bgUrl.trim(), bgSettings);
    }, [bgUrl, bgSettings]);

    const saveList = async (list: SavedIcon[]) => { setSaved(list); await DataStore.set(DATA_SAVED, list); };
    const saveBgList = async (list: SavedIcon[]) => { setBgSaved(list); await DataStore.set("customDMIcon_bgSaved", list); };

    const handleApplyIcon = async () => {
        const url = inputUrl.trim();
        if (!url) return;
        await DataStore.set(DATA_CURRENT, url);
        applyIcon(url);
        modalProps.onClose();
    };
    const handleFile = (file: File, setter: (s: string) => void) => {
        if (!file.type.startsWith("image/")) return;
        const r = new FileReader();
        r.onload = () => setter(r.result as string);
        r.readAsDataURL(file);
    };
    const handleSaveIcon = async () => {
        const url = inputUrl.trim(); if (!url) return;
        await saveList([...saved, { id: Date.now().toString(), url, name: `Icon ${saved.length + 1}` }]);
    };
    const handleResetIcon = async () => { await DataStore.del(DATA_CURRENT); applyIcon(null); modalProps.onClose(); };

    const handleApplyBg = async () => {
        const url = bgUrl.trim();
        if (!url) return;
        await DataStore.set(DATA_BG, url);
        await DataStore.set(DATA_BG_SETTINGS, bgSettings);
        applyBackground(url, bgSettings);
        modalProps.onClose();
    };
    const handleSaveBg = async () => {
        const url = bgUrl.trim(); if (!url) return;
        await saveBgList([...bgSaved, { id: Date.now().toString(), url, name: `BG ${bgSaved.length + 1}` }]);
    };
    const handleResetBg = async () => {
        await DataStore.del(DATA_BG);
        await DataStore.del(DATA_BG_SETTINGS);
        document.getElementById(STYLE_BG_ID)?.remove();
        modalProps.onClose();
    };
    const handleDelete = async (id: string) => { await saveList(saved.filter(s => s.id !== id)); };
    const handleDeleteBg = async (id: string) => { await saveBgList(bgSaved.filter(s => s.id !== id)); };

    const handleApplyDiscordLogo = async () => {
        const url = discordUrl.trim(); if (!url) return;
        await DataStore.set(DATA_DISCORD_LOGO, url);
        applyGlobalDiscordLogo(url);
        modalProps.onClose();
    };
    const handleResetDiscordLogo = async () => {
        await DataStore.del(DATA_DISCORD_LOGO);
        document.getElementById(STYLE_DISCORD_LOGO_ID)?.remove();
        setDiscordUrl("");
        modalProps.onClose();
    };

    const preview = inputUrl.trim() || currentUrl;

    return (
        <Modal
            {...modalProps}
            title={tab === "icon" ? "Icône Messages Privés" : tab === "bg" ? "Arrière-plan Discord" : "Logo Discord Global"}
            subtitle="Triple-clic sur le bouton Home pour rouvrir"
            actions={
                tab === "icon" ? [
                    { text: "Réinitialiser", variant: "secondary", onClick: handleResetIcon },
                    { text: "Annuler", variant: "secondary", onClick: modalProps.onClose },
                    { text: "Appliquer", variant: "primary", onClick: handleApplyIcon, disabled: !inputUrl.trim() },
                ] : tab === "bg" ? [
                    { text: "Supprimer fond", variant: "secondary", onClick: handleResetBg },
                    { text: "Annuler", variant: "secondary", onClick: modalProps.onClose },
                    { text: "Appliquer fond", variant: "primary", onClick: handleApplyBg, disabled: !bgUrl.trim() },
                ] : [
                    { text: "Réinitialiser", variant: "secondary", onClick: handleResetDiscordLogo },
                    { text: "Annuler", variant: "secondary", onClick: modalProps.onClose },
                    { text: "Appliquer logo", variant: "primary", onClick: handleApplyDiscordLogo, disabled: !discordUrl.trim() },
                ]
            }
        >
            {/* Tabs */}
            <Flex gap={6} style={{ marginBottom: 12, flexWrap: "wrap" as const }}>
                <Button color={tab === "icon" ? Button.Colors.BRAND : Button.Colors.PRIMARY} look={tab === "icon" ? Button.Looks.FILLED : Button.Looks.OUTLINED} onClick={() => setTab("icon")}>🎨 Icône MPs</Button>
                <Button color={tab === "bg" ? Button.Colors.BRAND : Button.Colors.PRIMARY} look={tab === "bg" ? Button.Looks.FILLED : Button.Looks.OUTLINED} onClick={() => setTab("bg")}>🖼️ Fond</Button>
                <Button color={tab === "discord" ? Button.Colors.BRAND : Button.Colors.PRIMARY} look={tab === "discord" ? Button.Looks.FILLED : Button.Looks.OUTLINED} onClick={() => setTab("discord")}>💠 Logo Discord</Button>
            </Flex>

            {tab === "icon" ? (
                <Flex flexDirection="column" gap={16} style={{ paddingTop: 4 }}>
                    <Flex gap={16} alignItems="center">
                        <div style={{
                            width: 72, height: 72, borderRadius: 18,
                            background: "var(--background-tertiary)",
                            backgroundImage: preview ? `url("${preview.replace(/"/g, '\\"')}")` : undefined,
                            backgroundSize: "cover", backgroundPosition: "center",
                            border: "2px solid var(--border-subtle)", flexShrink: 0
                        }} />
                        <div style={{ flex: 1 }}>
                            <Forms.FormTitle tag="h5">Prévisualisation</Forms.FormTitle>
                            <Forms.FormText>{preview ? "Rendu à la place du logo Discord" : "Aucune icône"}</Forms.FormText>
                        </div>
                    </Flex>
                    <div>
                        <Forms.FormTitle tag="h5">URL de l'image</Forms.FormTitle>
                        <TextInput placeholder="https://i.imgur.com/...png" value={inputUrl} onChange={setInputUrl} />
                        <Flex gap={8} style={{ marginTop: 8 }}>
                            <Button size={Button.Sizes.SMALL} onClick={handleSaveIcon} disabled={!inputUrl.trim()}>Sauvegarder dans la galerie</Button>
                        </Flex>
                    </div>
                    <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={e => { e.preventDefault(); setDragOver(false); const f = (e as any).dataTransfer.files[0]; if (f) handleFile(f, setInputUrl); }}
                        style={{
                            border: `2px dashed ${dragOver ? "var(--brand-500)" : "var(--border-subtle)"}`,
                            borderRadius: 8, padding: 16, textAlign: "center" as const,
                            background: dragOver ? "var(--background-modifier-hover)" : "transparent", cursor: "pointer"
                        }}
                        onClick={() => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.onchange = () => { const f = i.files?.[0]; if (f) handleFile(f, setInputUrl); }; i.click(); }}
                    >
                        <div style={{ fontWeight: 600 }}>📁 Clique ou glisse une image ici</div>
                        <div style={{ fontSize: 12, opacity: 0.6 }}>PNG, JPG, GIF, WEBP → base64</div>
                    </div>
                    <div>
                        <Forms.FormTitle tag="h5">Galerie icônes ({saved.length})</Forms.FormTitle>
                        {saved.length === 0 ? <div style={{ opacity: 0.6, fontSize: 13, padding: 8, border: "1px solid var(--border-subtle)", borderRadius: 6 }}>Aucune icône sauvegardée.</div> : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8, maxHeight: 180, overflowY: "auto", padding: 4 }}>
                                {saved.map(item => (
                                    <div key={item.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 6, textAlign: "center" as const, background: "var(--background-secondary)" }}>
                                        <div onClick={() => setInputUrl(item.url)} style={{ width: "100%", aspectRatio: "1", borderRadius: 12, backgroundImage: `url("${item.url.replace(/"/g, '\\"')}")`, backgroundSize: "cover", backgroundPosition: "center", cursor: "pointer", border: inputUrl === item.url ? "2px solid var(--brand-500)" : "2px solid transparent" }} />
                                        <div style={{ fontSize: 11, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                                        <Flex gap={4} justifyContent="center" style={{ marginTop: 4 }}>
                                            <Button size={Button.Sizes.TINY} onClick={() => setInputUrl(item.url)}>Charger</Button>
                                            <Button size={Button.Sizes.TINY} color={Button.Colors.RED} look={Button.Looks.LINK} onClick={() => handleDelete(item.id)}>X</Button>
                                        </Flex>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Flex>
            ) : tab === "bg" ? (
                <Flex flexDirection="column" gap={16} style={{ paddingTop: 4 }}>
                    {/* Preview BG */}
                    <div style={{
                        height: 96, borderRadius: 8,
                        backgroundImage: bgUrl.trim() ? `url("${bgUrl.trim().replace(/"/g, '\\"')}")` : undefined,
                        backgroundSize: "cover", backgroundPosition: "center",
                        border: "1px solid var(--border-subtle)",
                        opacity: bgSettings.opacity / 100,
                        filter: `blur(${bgSettings.blur}px) brightness(${bgSettings.brightness}%)`
                    }} />
                    <div>
                        <Forms.FormTitle tag="h5">URL arrière-plan</Forms.FormTitle>
                        <TextInput placeholder="https://images.unsplash.com/..." value={bgUrl} onChange={setBgUrl} />
                        <Flex gap={8} style={{ marginTop: 8 }}>
                            <Button size={Button.Sizes.SMALL} onClick={handleSaveBg} disabled={!bgUrl.trim()}>Sauvegarder ce fond</Button>
                        </Flex>
                    </div>
                    <div
                        onDragOver={e => { e.preventDefault(); setBgDragOver(true); }}
                        onDragLeave={() => setBgDragOver(false)}
                        onDrop={e => { e.preventDefault(); setBgDragOver(false); const f = (e as any).dataTransfer.files[0]; if (f) handleFile(f, setBgUrl); }}
                        style={{
                            border: `2px dashed ${bgDragOver ? "var(--brand-500)" : "var(--border-subtle)"}`,
                            borderRadius: 8, padding: 12, textAlign: "center" as const,
                            background: bgDragOver ? "var(--background-modifier-hover)" : "transparent", cursor: "pointer"
                        }}
                        onClick={() => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.onchange = () => { const f = i.files?.[0]; if (f) handleFile(f, setBgUrl); }; i.click(); }}
                    >
                        <div style={{ fontWeight: 600 }}>📁 Clique ou glisse un fond ici</div>
                    </div>

                    {/* Sliders */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, background: "var(--background-secondary)", padding: 12, borderRadius: 8 }}>
                        <div>
                            <Forms.FormTitle tag="h5">Opacité image : {bgSettings.opacity}%</Forms.FormTitle>
                            <input type="range" min={0} max={100} value={bgSettings.opacity} onChange={e => setBgSettings({ ...bgSettings, opacity: parseInt(e.target.value) })} style={{ width: "100%" }} />
                            <Forms.FormText>0% = invisible, 100% = opaque</Forms.FormText>
                        </div>
                        <div>
                            <Forms.FormTitle tag="h5">Transparence panels Discord : {bgSettings.panelOpacity}%</Forms.FormTitle>
                            <input type="range" min={20} max={100} value={bgSettings.panelOpacity} onChange={e => setBgSettings({ ...bgSettings, panelOpacity: parseInt(e.target.value) })} style={{ width: "100%" }} />
                            <Forms.FormText>75% = semi-transparent (recommandé), 100% = opaque</Forms.FormText>
                        </div>
                        <div>
                            <Forms.FormTitle tag="h5">Flou : {bgSettings.blur}px</Forms.FormTitle>
                            <input type="range" min={0} max={20} value={bgSettings.blur} onChange={e => setBgSettings({ ...bgSettings, blur: parseInt(e.target.value) })} style={{ width: "100%" }} />
                        </div>
                        <div>
                            <Forms.FormTitle tag="h5">Luminosité : {bgSettings.brightness}%</Forms.FormTitle>
                            <input type="range" min={50} max={130} value={bgSettings.brightness} onChange={e => setBgSettings({ ...bgSettings, brightness: parseInt(e.target.value) })} style={{ width: "100%" }} />
                        </div>
                        <Flex gap={8}>
                            <Button size={Button.Sizes.SMALL} onClick={async () => { await DataStore.set(DATA_BG_SETTINGS, bgSettings); if (bgUrl.trim()) applyBackground(bgUrl.trim(), bgSettings); }}>Prévisualiser</Button>
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.TRANSPARENT} look={Button.Looks.LINK} onClick={() => setBgSettings(DEFAULT_BG_SETTINGS)}>Reset sliders</Button>
                        </Flex>
                    </div>

                    <div>
                        <Forms.FormTitle tag="h5">Fonds sauvegardés ({bgSaved.length})</Forms.FormTitle>
                        {bgSaved.length === 0 ? <div style={{ opacity: 0.6, fontSize: 13, padding: 8, border: "1px solid var(--border-subtle)", borderRadius: 6 }}>Aucun fond sauvegardé.</div> : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8, maxHeight: 150, overflowY: "auto" }}>
                                {bgSaved.map(item => (
                                    <div key={item.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 6, background: "var(--background-secondary)" }}>
                                        <div onClick={() => setBgUrl(item.url)} style={{ width: "100%", height: 60, borderRadius: 6, backgroundImage: `url("${item.url.replace(/"/g, '\\"')}")`, backgroundSize: "cover", backgroundPosition: "center", cursor: "pointer" }} />
                                        <Flex gap={4} justifyContent="center" style={{ marginTop: 4 }}>
                                            <Button size={Button.Sizes.TINY} onClick={() => setBgUrl(item.url)}>Charger</Button>
                                            <Button size={Button.Sizes.TINY} color={Button.Colors.RED} look={Button.Looks.LINK} onClick={() => handleDeleteBg(item.id)}>X</Button>
                                        </Flex>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Flex>
            ) : (
                <Flex flexDirection="column" gap={16} style={{ paddingTop: 4 }}>
                    <Flex gap={12} alignItems="center">
                        <div style={{
                            width: 56, height: 56, borderRadius: 12,
                            background: "var(--background-secondary)",
                            backgroundImage: discordUrl.trim() ? `url("${discordUrl.trim().replace(/"/g, '\\"')}")` : undefined,
                            backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat",
                            border: "1px solid var(--border-subtle)", flexShrink: 0,
                            animation: discordUrl.trim() ? "vc-discord-pulse 1.8s ease-in-out infinite" : undefined
                        }} />
                        <div style={{ flex: 1 }}>
                            <Forms.FormTitle tag="h5">Logo Discord global</Forms.FormTitle>
                            <Forms.FormText>Remplace TOUS les logos Discord (splash au lancement + écrans de chargement) en gardant l'animation pulse</Forms.FormText>
                        </div>
                    </Flex>
                    <div>
                        <Forms.FormTitle tag="h5">URL du logo</Forms.FormTitle>
                        <TextInput placeholder="https://i.imgur.com/...png" value={discordUrl} onChange={setDiscordUrl} />
                        <Forms.FormText>Utilise la même image que l'icône MPs ou une autre. Tu peux aussi utiliser un GIF animé !</Forms.FormText>
                        <Flex gap={8} style={{ marginTop: 8 }}>
                            <Button size={Button.Sizes.SMALL} onClick={() => setDiscordUrl(inputUrl)} disabled={!inputUrl.trim()}>Utiliser l'icône MPs</Button>
                        </Flex>
                    </div>
                    <div
                        onDragOver={e => { e.preventDefault(); setDiscordDragOver(true); }}
                        onDragLeave={() => setDiscordDragOver(false)}
                        onDrop={e => { e.preventDefault(); setDiscordDragOver(false); const f = (e as any).dataTransfer.files[0]; if (f) { const r = new FileReader(); r.onload = () => setDiscordUrl(r.result as string); r.readAsDataURL(f); } }}
                        style={{
                            border: `2px dashed ${discordDragOver ? "var(--brand-500)" : "var(--border-subtle)"}`,
                            borderRadius: 8, padding: 12, textAlign: "center" as const,
                            background: discordDragOver ? "var(--background-modifier-hover)" : "transparent", cursor: "pointer"
                        }}
                        onClick={() => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.onchange = () => { const f = i.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => setDiscordUrl(r.result as string); r.readAsDataURL(f); } }; i.click(); }}
                    >
                        <div style={{ fontWeight: 600 }}>📁 Clique ou glisse le logo ici</div>
                        <div style={{ fontSize: 12, opacity: 0.6 }}>PNG / GIF / WEBP animé gardé</div>
                    </div>
                    <div style={{ background: "var(--background-secondary)", padding: 10, borderRadius: 8, fontSize: 13 }}>
                        <b>Pour le Bureau (raccourci) :</b> L'icône du raccourci Windows n'est pas dans Discord.<br />
                        Après avoir appliqué le logo ici, clique <b>Appliquer logo</b> puis je te génère le <b>.ico pour le Bureau</b> sur demande — dis-moi et je change ton raccourci automatiquement.
                    </div>
                </Flex>
            )}
        </Modal>
    );
}

function openIconModal() {
    openModal(modalProps => <IconModal modalProps={modalProps} />);
}

export default definePlugin({
    name: "CustomDMIcon",
    description: "Triple-clic icône MPs + arrière-plan Discord avec réglage transparence/blur.",
    authors: [{ name: "Motata", id: 0n }],
    tags: ["ui", "customization"],

    toolboxActions: {
        "Changer icône / Fond": openIconModal
    },

    async start() {
        await loadCurrent();
        let clicks: number[] = [];
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const homeBtn = target.closest?.('[data-list-item-id="guildsnav___home"]');
            if (!homeBtn) return;
            const now = Date.now();
            clicks.push(now);
            clicks = clicks.filter(t => now - t < 600);
            if (clicks.length === 3) {
                e.preventDefault(); e.stopPropagation(); clicks = []; openIconModal();
            }
            setTimeout(() => { clicks = clicks.filter(t => Date.now() - t < 600); }, 650);
        };
        (this as any)._clickHandler = handler;
        document.addEventListener("click", handler, true);
        const styleHint = document.createElement("style");
        styleHint.id = "vc-customDMIcon-hint";
        styleHint.textContent = `div[data-list-item-id="guildsnav___home"] { cursor: pointer; }`;
        document.head.appendChild(styleHint);
    },

    stop() {
        const handler = (this as any)._clickHandler;
        if (handler) document.removeEventListener("click", handler, true);
        document.getElementById(STYLE_ID)?.remove();
        document.getElementById(STYLE_BG_ID)?.remove();
        document.getElementById(STYLE_DISCORD_LOGO_ID)?.remove();
        document.getElementById("vc-customDMIcon-hint")?.remove();
    }
});
