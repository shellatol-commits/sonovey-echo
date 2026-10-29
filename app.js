const $ = (id) => document.getElementById(id);
const state = { items: [], filter: "all", currentUrl: "", currentTitle: "", currentCreator: "" };
let toastTimer;
function toast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}
function safeUrl(value) {
  try { const u = new URL(value, window.location.href); return ["http:", "https:", "blob:"].includes(u.protocol) ? u.href : null; }
  catch { return null; }
}
function isVideo(item) {
  const type = String(item.type || item.Type || "").toLowerCase();
  const url = String(item.url || item.mediaUrl || item.MediaURL || "");
  return type.includes("video") || /\.(mp4|webm|ogv|mov)(\?.*)?$/i.test(url);
}
function playMedia(url, title = "Shared media", creator = "External link", kind = "") {
  const clean = safeUrl(url);
  if (!clean) { toast("That doesn't look like a supported http(s) media link."); return; }
  const stage = $("media-stage");
  const video = kind === "video" || /\.(mp4|webm|ogv|mov)(\?.*)?$/i.test(clean);
  const media = document.createElement(video ? "video" : "audio");
  media.controls = true; media.autoplay = true; media.preload = "metadata"; media.src = clean;
  if (video) { media.playsInline = true; media.style.width = "100%"; }
  media.addEventListener("error", () => toast("The link couldn't be played. Try a direct audio/video file URL."));
  stage.replaceChildren(media);
  $("track-title").textContent = title || "Shared media";
  $("track-subtitle").textContent = creator || "External link";
  $("track-art").textContent = video ? "▶" : "♪";
  $("player-status").textContent = "PLAYING";
  state.currentUrl = clean; state.currentTitle = title; state.currentCreator = creator;
  $("media-url").value = clean;
  history.replaceState({}, "", `${location.pathname}?q=${encodeURIComponent(clean)}${location.hash}`);
  media.play().catch(() => { $("player-status").textContent = "READY"; });
  $("player").scrollIntoView({ behavior: "smooth", block: "start" });
}
function playLocal(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  playMedia(url, file.name, "Local file · only on this device", file.type.startsWith("video/") ? "video" : "audio");
  $("player-status").textContent = "LOCAL FILE";
  toast("Local file loaded. Its temporary link only works on this device.");
}
function getField(record, ...names) {
  const fields = record?.fields || record || {};
  for (const name of names) if (fields[name] !== undefined && fields[name] !== null) return fields[name];
  return "";
}
function normalizeRecord(record) {
  return {
    id: record.id || "",
    title: getField(record, "Title", "title", "Name", "name") || "Untitled media",
    creator: getField(record, "Creator", "creator", "Artist", "artist") || "Unknown creator",
    type: String(getField(record, "Type", "type", "Media Type", "MediaType") || "audio").toLowerCase(),
    url: getField(record, "MediaURL", "Media URL", "URL", "url", "mediaUrl"),
    artwork: getField(record, "ArtworkURL", "Artwork URL", "Artwork", "artwork"),
    album: getField(record, "Album", "album") || ""
  };
}
function renderCatalog() {
  const query = $("catalog-search").value.trim().toLowerCase();
  const items = state.items.filter(item => {
    const typeMatch = state.filter === "all" || (state.filter === "video" ? isVideo(item) : !isVideo(item));
    const textMatch = [item.title, item.creator, item.album, item.type].join(" ").toLowerCase().includes(query);
    return typeMatch && textMatch && safeUrl(item.url);
  });
  const grid = $("catalog-grid"); grid.replaceChildren();
  if (!items.length) {
    const box = document.createElement("div"); box.className = "empty-state";
    const icon = document.createElement("div"); icon.className = "empty-icon"; icon.textContent = "⌁";
    const h = document.createElement("h3"); h.textContent = state.items.length ? "Nothing matches that search" : "Your catalog is waiting";
    const p = document.createElement("p"); p.textContent = state.items.length ? "Try a different search or media filter." : "Add published media records to your Airtable Media table, then refresh.";
    box.append(icon, h, p); grid.append(box); return;
  }
  for (const item of items) {
    const card = document.createElement("article"); card.className = "media-card"; card.tabIndex = 0; card.setAttribute("role", "button");
    const art = document.createElement("div"); art.className = "card-art"; art.textContent = isVideo(item) ? "▶" : "♫";
    const tag = document.createElement("span"); tag.className = "type-tag"; tag.textContent = isVideo(item) ? "Video" : "Audio"; art.append(tag);
    if (item.artwork && safeUrl(item.artwork)) { const img = document.createElement("img"); img.src = item.artwork; img.alt = ""; img.loading = "lazy"; img.onerror = () => img.remove(); art.append(img); }
    const copy = document.createElement("div"); copy.className = "card-copy";
    const title = document.createElement("h3"); title.textContent = item.title;
    const creator = document.createElement("p"); creator.textContent = item.creator + (item.album ? ` · ${item.album}` : "");
    copy.append(title, creator); card.append(art, copy);
    card.addEventListener("click", () => playMedia(item.url, item.title, item.creator, isVideo(item) ? "video" : "audio"));
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); card.click(); } });
    grid.append(card);
  }
}
async function loadCatalog() {
  $("catalog-note").textContent = "Loading published media…";
  try {
    const response = await fetch("/api/catalog", { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(response.status === 404 ? "Catalog API isn't deployed yet." : `Catalog request failed (${response.status}).`);
    const data = await response.json();
    state.items = (Array.isArray(data.records) ? data.records : Array.isArray(data) ? data : []).map(normalizeRecord);
    renderCatalog();
    $("catalog-note").textContent = data.configured === false ? "Airtable isn't configured yet. Add the Vercel environment variables in README.md." : `${state.items.length} catalog item${state.items.length === 1 ? "" : "s"} loaded.`;
  } catch (error) {
    state.items = []; renderCatalog();
    $("catalog-note").textContent = error.message || "Couldn't connect to the catalog.";
  }
}
$("local-file-button").addEventListener("click", () => $("local-file").click());
$("local-file").addEventListener("change", e => playLocal(e.target.files?.[0]));
$("play-url").addEventListener("click", () => playMedia($("media-url").value.trim()));
$("media-url").addEventListener("keydown", e => { if (e.key === "Enter") $("play-url").click(); });
$("paste-link-button").addEventListener("click", async () => {
  try { const text = await navigator.clipboard.readText(); if (safeUrl(text)) { $("media-url").value = text; playMedia(text); } else { $("media-url").focus(); toast("Paste a direct media URL into the player."); } }
  catch { $("media-url").focus(); toast("Paste a direct media URL into the player."); }
});
$("copy-share").addEventListener("click", async () => {
  if (!state.currentUrl || state.currentUrl.startsWith("blob:")) { toast("Choose a hosted media URL first; local file links can't be shared."); return; }
  const share = `${location.origin}${location.pathname}?q=${encodeURIComponent(state.currentUrl)}`;
  try { await navigator.clipboard.writeText(share); toast("Shareable Sonovey Echo link copied."); }
  catch { window.prompt("Copy this share link:", share); }
});
$("catalog-search").addEventListener("input", renderCatalog);
document.querySelectorAll(".filter").forEach(button => button.addEventListener("click", () => {
  state.filter = button.dataset.filter;
  document.querySelectorAll(".filter").forEach(b => b.classList.toggle("active", b === button));
  renderCatalog();
}));
$("refresh-catalog").addEventListener("click", loadCatalog);
window.addEventListener("DOMContentLoaded", () => {
  const q = new URLSearchParams(location.search).get("q");
  if (q) { $("media-url").value = q; playMedia(q, "Shared media", "Opened from a Sonovey Echo link"); }
  loadCatalog();
});
