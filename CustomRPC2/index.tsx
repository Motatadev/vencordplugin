import { definePluginSettings } from "@api/Settings";
import * as DataStore from "@api/DataStore";
import { getUserSettingLazy } from "@api/UserSettings";
import { Flex } from "@components/Flex";
import { Devs } from "@utils/constants";
import { Margins } from "@utils/margins";
import definePlugin, { OptionType } from "@utils/types";
import { Activity } from "@vencord/discord-types";
import { ActivityType } from "@vencord/discord-types/enums";
import { Button, Forms, TextInput, Select, Switch, Text, FluxDispatcher, UserStore, Modal, openModal } from "@webpack/common";
import { React, useEffect, useState } from "@webpack/common";

const ShowCurrentGame = getUserSettingLazy<boolean>("status", "showCurrentGame")!;

const PRESETS_KEY = "customRPC2_presets";
const ACTIVE_PRESET_KEY = "customRPC2_active";

// Helper: external image -> mp:external/<b64>
function toExternalImage(url: string): string {
    if (!url) return url;
    if (url.startsWith("mp:")) return url;
    if (url.startsWith("http://") || url.startsWith("https://")) {
        try {
            // Discord uses base64 of URL without padding, with +/ replaced?
            // Simple mp:external with b64 works for most
            const b64 = btoa(url).replace(/=/g, "");
            return `mp:external/${b64}/https`;
        } catch { return url; }
    }
    return url;
}

async function createActivityFromStore(s: any): Promise<Activity | undefined> {
    if (!s.appName) return;
    const activity: any = {
        application_id: s.appID || "0",
        name: s.appName,
        details: s.details || undefined,
        state: s.state || undefined,
        type: s.type ?? ActivityType.PLAYING,
        flags: 1 << 0,
    };
    if (s.type === ActivityType.STREAMING && s.streamLink) activity.url = s.streamLink;
    if (s.detailsURL) activity.details_url = s.detailsURL;
    if (s.stateURL) activity.state_url = s.stateURL;

    // timestamps
    if (s.timestampMode === 1) activity.timestamps = { start: Date.now() };
    else if (s.timestampMode === 2) activity.timestamps = { start: Date.now() - (new Date().getHours()*3600 + new Date().getMinutes()*60 + new Date().getSeconds())*1000 };
    else if (s.timestampMode === 3 && (s.startTime || s.endTime)) {
        activity.timestamps = {};
        if (s.startTime) activity.timestamps.start = s.startTime;
        if (s.endTime) activity.timestamps.end = s.endTime;
    }

    // buttons
    if (s.buttonOneText) {
        activity.buttons = [s.buttonOneText, s.buttonTwoText].filter(Boolean);
        activity.metadata = { button_urls: [s.buttonOneURL, s.buttonTwoURL].filter(Boolean) };
    }

    // assets - support external URLs without appID
    const assets: any = {};
    if (s.imageBig) {
        const isUrl = s.imageBig.startsWith("http");
        assets.large_image = isUrl ? toExternalImage(s.imageBig) : s.imageBig;
        if (s.imageBigTooltip) assets.large_text = s.imageBigTooltip;
        if (s.imageBigURL) assets.large_url = s.imageBigURL;
    }
    if (s.imageSmall) {
        const isUrl = s.imageSmall.startsWith("http");
        assets.small_image = isUrl ? toExternalImage(s.imageSmall) : s.imageSmall;
        if (s.imageSmallTooltip) assets.small_text = s.imageSmallTooltip;
        if (s.imageSmallURL) assets.small_url = s.imageSmallURL;
    }
    if (Object.keys(assets).length) activity.assets = assets;

    if (s.partySize && s.partyMaxSize) activity.party = { size: [s.partySize, s.partyMaxSize] };

    // clean empty
    for (const k in activity) if (k !== "type" && !activity[k]) delete activity[k];
    if (activity.assets && !activity.assets.large_image && !activity.assets.small_image) delete activity.assets;

    return activity as Activity;
}

export async function setRpc(disable?: boolean) {
    const s = settings.store as any;
    if (disable || !s.enabled) {
        FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity: null, socketId: "CustomRPC2" });
        return;
    }
    const activity = await createActivityFromStore(s);
    FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity: activity || null, socketId: "CustomRPC2" });
}

export const settings = definePluginSettings({
    enabled: { type: OptionType.BOOLEAN, description: "Enable RPC", default: true },
    appID: { type: OptionType.STRING, description: "Application ID (optional, 0 for external images)", default: "" },
    appName: { type: OptionType.STRING, description: "Application Name", default: "CustomRPC2" },
    type: { type: OptionType.SELECT, description: "Activity Type", options: [
        { label: "Playing", value: ActivityType.PLAYING, default: true },
        { label: "Streaming", value: ActivityType.STREAMING },
        { label: "Listening", value: ActivityType.LISTENING },
        { label: "Watching", value: ActivityType.WATCHING },
        { label: "Competing", value: ActivityType.COMPETING },
    ]},
    details: { type: OptionType.STRING, description: "Details (line 1)", default: "" },
    detailsURL: { type: OptionType.STRING, description: "Details URL", default: "" },
    state: { type: OptionType.STRING, description: "State (line 2)", default: "" },
    stateURL: { type: OptionType.STRING, description: "State URL", default: "" },
    streamLink: { type: OptionType.STRING, description: "Stream URL (if Streaming)", default: "" },
    imageBig: { type: OptionType.STRING, description: "Large Image (key or https:// URL)", default: "" },
    imageBigTooltip: { type: OptionType.STRING, description: "Large Image Tooltip", default: "" },
    imageBigURL: { type: OptionType.STRING, description: "Large Image Click URL", default: "" },
    imageSmall: { type: OptionType.STRING, description: "Small Image (key or https:// URL)", default: "" },
    imageSmallTooltip: { type: OptionType.STRING, description: "Small Image Tooltip", default: "" },
    imageSmallURL: { type: OptionType.STRING, description: "Small Image Click URL", default: "" },
    buttonOneText: { type: OptionType.STRING, description: "Button 1 Text", default: "" },
    buttonOneURL: { type: OptionType.STRING, description: "Button 1 URL", default: "" },
    buttonTwoText: { type: OptionType.STRING, description: "Button 2 Text", default: "" },
    buttonTwoURL: { type: OptionType.STRING, description: "Button 2 URL", default: "" },
    partySize: { type: OptionType.NUMBER, description: "Party Size", default: 0 },
    partyMaxSize: { type: OptionType.NUMBER, description: "Party Max Size", default: 0 },
    timestampMode: { type: OptionType.SELECT, description: "Timestamp", options: [
        { label: "None", value: 0, default: true },
        { label: "Since now", value: 1 },
        { label: "Since day start", value: 2 },
        { label: "Custom", value: 3 },
    ]},
    startTime: { type: OptionType.NUMBER, description: "Custom Start (ms)", default: 0 },
    endTime: { type: OptionType.NUMBER, description: "Custom End (ms)", default: 0 },
});

function PresetManager() {
    const [presets, setPresets] = useState<any[]>([]);
    const [name, setName] = useState("");
    useEffect(() => { DataStore.get(PRESETS_KEY).then(v => { if (Array.isArray(v)) setPresets(v as any[]); }); }, []);
    const savePresets = async (list: any[]) => { setPresets(list); await DataStore.set(PRESETS_KEY, list); };
    const saveCurrent = async () => {
        if (!name.trim()) return;
        const data = { ...settings.store } as any;
        const newList = [...presets.filter(p => p.name !== name.trim()), { name: name.trim(), data }];
        await savePresets(newList);
        setName("");
    };
    const loadPreset = async (p: any) => {
        for (const k in p.data) (settings.store as any)[k] = p.data[k];
        await DataStore.set(ACTIVE_PRESET_KEY, p.name);
        setRpc();
    };
    const delPreset = async (n: string) => { await savePresets(presets.filter(p => p.name !== n)); };
    const exportJson = () => {
        const blob = new Blob([JSON.stringify(settings.store, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "ultra-rpc.json"; a.click(); URL.revokeObjectURL(url);
    };
    const importJson = () => {
        const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json";
        inp.onchange = () => {
            const f = inp.files?.[0]; if (!f) return;
            const r = new FileReader(); r.onload = async () => {
                try { const data = JSON.parse(r.result as string); for (const k in data) (settings.store as any)[k] = data[k]; setRpc(); } catch {}
            }; r.readAsText(f);
        }; inp.click();
    };
    return (
        <div style={{ background: "var(--background-secondary)", padding: 12, borderRadius: 8, marginTop: 12 }}>
            <Forms.FormTitle tag="h5">Presets (save/load) — fully shareable</Forms.FormTitle>
            <Flex gap={8} style={{ marginTop: 8 }}>
                <TextInput value={name} onChange={setName} placeholder="Preset name (e.g. Gaming, Chill)" style={{ flex: 1 }} />
                <Button onClick={saveCurrent}>Save</Button>
                <Button color={Button.Colors.PRIMARY} look={Button.Looks.OUTLINED} onClick={exportJson}>Export</Button>
                <Button color={Button.Colors.PRIMARY} look={Button.Looks.OUTLINED} onClick={importJson}>Import</Button>
            </Flex>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {presets.map(p => (
                    <div key={p.name} style={{ display: "flex", gap: 4, background: "var(--background-tertiary)", padding: "4px 8px", borderRadius: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                        <Button size={Button.Sizes.TINY} onClick={() => loadPreset(p)}>Load</Button>
                        <Button size={Button.Sizes.TINY} color={Button.Colors.RED} look={Button.Looks.LINK} onClick={() => delPreset(p.name)}>X</Button>
                    </div>
                ))}
                {presets.length === 0 && <Forms.FormText>No presets yet. Save your current config!</Forms.FormText>}
            </div>
        </div>
    );
}

function RPCSettingsPanel() {
    const s = settings.use();
    const [activity, setActivity] = useState<Activity | undefined>();
    useEffect(() => { createActivityFromStore(settings.store).then(setActivity); }, [JSON.stringify(s)]);
    const gameEnabled = ShowCurrentGame.useSetting();
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {!gameEnabled && (
                <div style={{ background: "var(--info-danger-background)", padding: 12, borderRadius: 8, border: "1px solid var(--info-danger-foreground)" }}>
                    <Forms.FormTitle tag="h5" style={{ color: "var(--info-danger-foreground)" }}>Visible to everyone? Enable Activity!</Forms.FormTitle>
                    <Forms.FormText>Your RPC is hidden — others can't see it. Enable "Display current activity" in Discord Settings → Activity Privacy.</Forms.FormText>
                    <Button color={Button.Colors.RED} style={{ marginTop: 8 }} onClick={() => ShowCurrentGame.updateSetting(true)}>Enable Activity Sharing</Button>
                </div>
            )}
            <Flex gap={8} alignItems="center">
                <Switch value={s.enabled} onChange={v => { (settings.store as any).enabled = v; setRpc(!v); }} />
                <Forms.FormTitle tag="h5" style={{ margin: 0 }}>RPC Enabled</Forms.FormTitle>
                <Button size={Button.Sizes.SMALL} onClick={() => setRpc()} style={{ marginLeft: "auto" }}>Refresh RPC</Button>
            </Flex>

            <Forms.FormTitle tag="h5">Main</Forms.FormTitle>
            <Flex gap={8}>
                <div style={{ flex: 1 }}><Forms.FormTitle tag="h5">App Name *</Forms.FormTitle><TextInput value={s.appName} onChange={v => { (settings.store as any).appName = v; setRpc(); }} placeholder="My Cool Activity" /></div>
                <div style={{ flex: 1 }}><Forms.FormTitle tag="h5">App ID (optional)</Forms.FormTitle><TextInput value={s.appID} onChange={v => { (settings.store as any).appID = v; setRpc(); }} placeholder="0 or 123456... (leave 0 for external images)" /></div>
            </Flex>
            <Select
                options={[
                    { label: "🎮 Playing", value: ActivityType.PLAYING },
                    { label: "🔴 Streaming", value: ActivityType.STREAMING },
                    { label: "🎵 Listening", value: ActivityType.LISTENING },
                    { label: "👀 Watching", value: ActivityType.WATCHING },
                    { label: "🏆 Competing", value: ActivityType.COMPETING },
                ]}
                select={v => { (settings.store as any).type = v; setRpc(); }}
                isSelected={v => v === s.type}
                serialize={v => String(v)}
            />
            <Flex gap={8}>
                <div style={{ flex: 1 }}><Forms.FormTitle tag="h5">Details (line 1)</Forms.FormTitle><TextInput value={s.details} onChange={v => { (settings.store as any).details = v; setRpc(); }} placeholder="e.g. Editing code" maxLength={128} /></div>
                <div style={{ flex: 1 }}><Forms.FormTitle tag="h5">State (line 2)</Forms.FormTitle><TextInput value={s.state} onChange={v => { (settings.store as any).state = v; setRpc(); }} placeholder="e.g. Vencord plugin" maxLength={128} /></div>
            </Flex>
            <Flex gap={8}>
                <div style={{ flex: 1 }}><Forms.FormTitle tag="h5">Details URL (clickable)</Forms.FormTitle><TextInput value={s.detailsURL} onChange={v => { (settings.store as any).detailsURL = v; setRpc(); }} placeholder="https://..." /></div>
                <div style={{ flex: 1 }}><Forms.FormTitle tag="h5">State URL</Forms.FormTitle><TextInput value={s.stateURL} onChange={v => { (settings.store as any).stateURL = v; setRpc(); }} placeholder="https://..." /></div>
            </Flex>
            {s.type === ActivityType.STREAMING && <div><Forms.FormTitle tag="h5">Stream URL</Forms.FormTitle><TextInput value={s.streamLink} onChange={v => { (settings.store as any).streamLink = v; setRpc(); }} placeholder="https://twitch.tv/..." /></div>}

            <Forms.FormTitle tag="h5" style={{ marginTop: 8 }}>Images — paste https:// URL for external (no app needed) or asset key</Forms.FormTitle>
            <Flex gap={8}>
                <div style={{ flex: 1 }}><Forms.FormTitle tag="h5">Large Image</Forms.FormTitle><TextInput value={s.imageBig} onChange={v => { (settings.store as any).imageBig = v; setRpc(); }} placeholder="https://i.imgur.com/...png or large_key" /></div>
                <div style={{ flex: 1 }}><Forms.FormTitle tag="h5">Large Tooltip</Forms.FormTitle><TextInput value={s.imageBigTooltip} onChange={v => { (settings.store as any).imageBigTooltip = v; setRpc(); }} placeholder="Hover text" /></div>
            </Flex>
            <TextInput value={s.imageBigURL} onChange={v => { (settings.store as any).imageBigURL = v; setRpc(); }} placeholder="Large image click URL (https://...)" />
            <Flex gap={8}>
                <div style={{ flex: 1 }}><Forms.FormTitle tag="h5">Small Image</Forms.FormTitle><TextInput value={s.imageSmall} onChange={v => { (settings.store as any).imageSmall = v; setRpc(); }} placeholder="https://... or small_key" /></div>
                <div style={{ flex: 1 }}><Forms.FormTitle tag="h5">Small Tooltip</Forms.FormTitle><TextInput value={s.imageSmallTooltip} onChange={v => { (settings.store as any).imageSmallTooltip = v; setRpc(); }} placeholder="Hover text" /></div>
            </Flex>
            <TextInput value={s.imageSmallURL} onChange={v => { (settings.store as any).imageSmallURL = v; setRpc(); }} placeholder="Small image click URL" />

            <Forms.FormTitle tag="h5" style={{ marginTop: 8 }}>Buttons (visible to everyone, up to 2)</Forms.FormTitle>
            <Flex gap={8}>
                <div style={{ flex: 1 }}><TextInput value={s.buttonOneText} onChange={v => { (settings.store as any).buttonOneText = v; setRpc(); }} placeholder="Button 1 text (max 31)" maxLength={31} /></div>
                <div style={{ flex: 1 }}><TextInput value={s.buttonOneURL} onChange={v => { (settings.store as any).buttonOneURL = v; setRpc(); }} placeholder="https://..." /></div>
            </Flex>
            <Flex gap={8}>
                <div style={{ flex: 1 }}><TextInput value={s.buttonTwoText} onChange={v => { (settings.store as any).buttonTwoText = v; setRpc(); }} placeholder="Button 2 text" maxLength={31} /></div>
                <div style={{ flex: 1 }}><TextInput value={s.buttonTwoURL} onChange={v => { (settings.store as any).buttonTwoURL = v; setRpc(); }} placeholder="https://..." /></div>
            </Flex>

            <Forms.FormTitle tag="h5" style={{ marginTop: 8 }}>Party & Timestamps</Forms.FormTitle>
            <Flex gap={8}>
                <div style={{ flex: 1 }}><Forms.FormTitle tag="h5">Party Size</Forms.FormTitle><TextInput value={String(s.partySize || "")} onChange={v => { (settings.store as any).partySize = parseInt(v) || 0; setRpc(); }} placeholder="1" /></div>
                <div style={{ flex: 1 }}><Forms.FormTitle tag="h5">Max Size</Forms.FormTitle><TextInput value={String(s.partyMaxSize || "")} onChange={v => { (settings.store as any).partyMaxSize = parseInt(v) || 0; setRpc(); }} placeholder="5" /></div>
            </Flex>
            <Select
                options={[
                    { label: "No timestamp", value: 0 },
                    { label: "Since now", value: 1 },
                    { label: "Since day start", value: 2 },
                    { label: "Custom", value: 3 },
                ]}
                select={v => { (settings.store as any).timestampMode = v; setRpc(); }}
                isSelected={v => v === s.timestampMode}
                serialize={v => String(v)}
            />

            <PresetManager />

            {/* Live Preview */}
            <div style={{ background: "var(--background-secondary)", padding: 12, borderRadius: 8, marginTop: 8 }}>
                <Forms.FormTitle tag="h5">Live Preview (what others see)</Forms.FormTitle>
                <div style={{ background: "var(--background-tertiary)", padding: 12, borderRadius: 8, marginTop: 8, display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 60, height: 60, borderRadius: 8, background: "var(--background-primary)", backgroundImage: s.imageBig?.startsWith("http") ? `url(${s.imageBig})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }} />
                    <div>
                        <div style={{ fontWeight: 700 }}>{s.appName || "App Name"}</div>
                        <div style={{ fontSize: 13, opacity: 0.9 }}>{s.details || "Details"}</div>
                        <div style={{ fontSize: 13, opacity: 0.7 }}>{s.state || "State"}</div>
                        {(s.buttonOneText || s.buttonTwoText) && <div style={{ fontSize: 11, marginTop: 4, display: "flex", gap: 4 }}>{s.buttonOneText && <span style={{ background: "var(--brand-500)", padding: "2px 6px", borderRadius: 4, color: "white" }}>{s.buttonOneText}</span>}{s.buttonTwoText && <span style={{ background: "var(--brand-500)", padding: "2px 6px", borderRadius: 4, color: "white" }}>{s.buttonTwoText}</span>}</div>}
                    </div>
                </div>
                <Forms.FormText style={{ marginTop: 6 }}>Everyone with Activity Sharing enabled will see this exactly. Buttons are hidden on your own profile but visible to others.</Forms.FormText>
            </div>
        </div>
    );
}


function CustomRPC2Modal({ modalProps }: { modalProps: any }) {
    const [tab, setTab] = React.useState<"main"|"images"|"buttons"|"time"|"presets">("main");
    const s = settings.use();
    const [local, setLocal] = React.useState<any>({ ...settings.store });
    React.useEffect(() => { setLocal({ ...settings.store }); }, [JSON.stringify(s)]);

    const update = (k: string, v: any) => {
        const next = { ...local, [k]: v };
        setLocal(next);
    };
    const apply = async () => {
        for (const k in local) (settings.store as any)[k] = local[k];
        await setRpc();
        modalProps.onClose();
    };
    const previewActivity = { ...local };

    return (
        <Modal {...modalProps} title="CustomRPC2 — Editor" subtitle="Fully customizable RPC • Visible to everyone if Activity Sharing is enabled" actions={[
            { text: "Cancel", variant: "secondary", onClick: modalProps.onClose },
            { text: "Save & Apply", variant: "primary", onClick: apply },
        ]}>
            <Flex gap={6} style={{ marginBottom: 12, flexWrap: "wrap" as const }}>
                <Button color={tab==="main"?Button.Colors.BRAND:Button.Colors.PRIMARY} look={tab==="main"?Button.Looks.FILLED:Button.Looks.OUTLINED} onClick={()=>setTab("main")}>Main</Button>
                <Button color={tab==="images"?Button.Colors.BRAND:Button.Colors.PRIMARY} look={tab==="images"?Button.Looks.FILLED:Button.Looks.OUTLINED} onClick={()=>setTab("images")}>Images</Button>
                <Button color={tab==="buttons"?Button.Colors.BRAND:Button.Colors.PRIMARY} look={tab==="buttons"?Button.Looks.FILLED:Button.Looks.OUTLINED} onClick={()=>setTab("buttons")}>Buttons</Button>
                <Button color={tab==="time"?Button.Colors.BRAND:Button.Colors.PRIMARY} look={tab==="time"?Button.Looks.FILLED:Button.Looks.OUTLINED} onClick={()=>setTab("time")}>Time/Party</Button>
                <Button color={tab==="presets"?Button.Colors.BRAND:Button.Colors.PRIMARY} look={tab==="presets"?Button.Looks.FILLED:Button.Looks.OUTLINED} onClick={()=>setTab("presets")}>Presets</Button>
            </Flex>

            {tab==="main" && (
                <Flex flexDirection="column" gap={10}>
                    <Flex gap={8}><div style={{flex:1}}><Forms.FormTitle tag="h5">App Name *</Forms.FormTitle><TextInput value={local.appName} onChange={v=>update("appName", v)} placeholder="My Activity" /></div><div style={{flex:1}}><Forms.FormTitle tag="h5">App ID (0 for external images)</Forms.FormTitle><TextInput value={local.appID} onChange={v=>update("appID", v)} placeholder="0" /></div></Flex>
                    <Select options={[{label:"🎮 Playing",value:0},{label:"🔴 Streaming",value:1},{label:"🎵 Listening",value:2},{label:"👀 Watching",value:3},{label:"🏆 Competing",value:5}]} select={v=>update("type", v)} isSelected={v=>v===local.type} serialize={v=>String(v)} />
                    <Flex gap={8}><div style={{flex:1}}><Forms.FormTitle tag="h5">Details (line 1)</Forms.FormTitle><TextInput value={local.details} onChange={v=>update("details", v)} /></div><div style={{flex:1}}><Forms.FormTitle tag="h5">State (line 2)</Forms.FormTitle><TextInput value={local.state} onChange={v=>update("state", v)} /></div></Flex>
                    <Flex gap={8}><div style={{flex:1}}><Forms.FormTitle tag="h5">Details URL</Forms.FormTitle><TextInput value={local.detailsURL} onChange={v=>update("detailsURL", v)} placeholder="https://" /></div><div style={{flex:1}}><Forms.FormTitle tag="h5">State URL</Forms.FormTitle><TextInput value={local.stateURL} onChange={v=>update("stateURL", v)} placeholder="https://" /></div></Flex>
                    {local.type===1 && <div><Forms.FormTitle tag="h5">Stream URL</Forms.FormTitle><TextInput value={local.streamLink} onChange={v=>update("streamLink", v)} placeholder="https://twitch.tv/..." /></div>}
                </Flex>
            )}
            {tab==="images" && (
                <Flex flexDirection="column" gap={10}>
                    <Forms.FormText>Paste <b>https://</b> for external images (no upload needed) or Discord asset key.</Forms.FormText>
                    <Flex gap={8}><div style={{flex:1}}><Forms.FormTitle tag="h5">Large Image</Forms.FormTitle><TextInput value={local.imageBig} onChange={v=>update("imageBig", v)} placeholder="https://i.imgur.com/... or key" /></div><div style={{flex:1}}><Forms.FormTitle tag="h5">Tooltip</Forms.FormTitle><TextInput value={local.imageBigTooltip} onChange={v=>update("imageBigTooltip", v)} /></div></Flex>
                    <TextInput value={local.imageBigURL} onChange={v=>update("imageBigURL", v)} placeholder="Large click URL" />
                    <Flex gap={8}><div style={{flex:1}}><Forms.FormTitle tag="h5">Small Image</Forms.FormTitle><TextInput value={local.imageSmall} onChange={v=>update("imageSmall", v)} /></div><div style={{flex:1}}><Forms.FormTitle tag="h5">Tooltip</Forms.FormTitle><TextInput value={local.imageSmallTooltip} onChange={v=>update("imageSmallTooltip", v)} /></div></Flex>
                    <TextInput value={local.imageSmallURL} onChange={v=>update("imageSmallURL", v)} placeholder="Small click URL" />
                </Flex>
            )}
            {tab==="buttons" && (
                <Flex flexDirection="column" gap={10}>
                    <Forms.FormText>Up to 2 buttons — visible to everyone (hidden on your own profile, visible to others).</Forms.FormText>
                    <Flex gap={8}><div style={{flex:1}}><Forms.FormTitle tag="h5">Button 1 Text</Forms.FormTitle><TextInput value={local.buttonOneText} onChange={v=>update("buttonOneText", v)} maxLength={31} /></div><div style={{flex:1}}><Forms.FormTitle tag="h5">URL</Forms.FormTitle><TextInput value={local.buttonOneURL} onChange={v=>update("buttonOneURL", v)} placeholder="https://" /></div></Flex>
                    <Flex gap={8}><div style={{flex:1}}><Forms.FormTitle tag="h5">Button 2 Text</Forms.FormTitle><TextInput value={local.buttonTwoText} onChange={v=>update("buttonTwoText", v)} maxLength={31} /></div><div style={{flex:1}}><Forms.FormTitle tag="h5">URL</Forms.FormTitle><TextInput value={local.buttonTwoURL} onChange={v=>update("buttonTwoURL", v)} placeholder="https://" /></div></Flex>
                </Flex>
            )}
            {tab==="time" && (
                <Flex flexDirection="column" gap={10}>
                    <Flex gap={8}><div style={{flex:1}}><Forms.FormTitle tag="h5">Party Size</Forms.FormTitle><TextInput value={String(local.partySize||"")} onChange={v=>update("partySize", parseInt(v)||0)} /></div><div style={{flex:1}}><Forms.FormTitle tag="h5">Max</Forms.FormTitle><TextInput value={String(local.partyMaxSize||"")} onChange={v=>update("partyMaxSize", parseInt(v)||0)} /></div></Flex>
                    <Select options={[{label:"No timestamp",value:0},{label:"Since now",value:1},{label:"Since day start",value:2},{label:"Custom",value:3}]} select={v=>update("timestampMode", v)} isSelected={v=>v===local.timestampMode} serialize={v=>String(v)} />
                </Flex>
            )}
            {tab==="presets" && (
                <PresetManager />
            )}

            {/* Preview */}
            <div style={{ background: "var(--background-secondary)", padding: 10, borderRadius: 8, marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: 8, background: "var(--background-tertiary)", backgroundImage: local.imageBig?.startsWith("http") ? `url(${local.imageBig})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }} />
                <div>
                    <div style={{ fontWeight: 700 }}>{local.appName || "App Name"}</div>
                    <div style={{ fontSize: 13, opacity: 0.9 }}>{local.details || "Details"}</div>
                    <div style={{ fontSize: 13, opacity: 0.7 }}>{local.state || "State"}</div>
                </div>
            </div>
        </Modal>
    );
}

function openCustomRPC2Modal() {
    openModal(props => <CustomRPC2Modal modalProps={props} />);
}

export default definePlugin({
    name: "CustomRPC2",
    description: "Fully customizable RPC visible to everyone — external images, buttons, presets, party, timestamps. Clean interface with preview.",
    authors: [Devs.AutumnVN, { name: "Motata", id: 0n }],
    tags: ["Activity"],
    settings,
    dependencies: ["UserSettingsAPI"],
    start: () => setRpc(),
    stop: () => setRpc(true),
    toolboxActions: {
        "Open CustomRPC2": openCustomRPC2Modal,
        "Toggle RPC": () => { (settings.store as any).enabled = !(settings.store as any).enabled; setRpc(!(settings.store as any).enabled); },
        "Refresh RPC": () => setRpc(),
    },
    settingsAboutComponent: RPCSettingsPanel,
});
