"use strict";

const STORAGE_KEY = "habernova-store";
const COMMENTS_KEY = "habernova-comments";
const THEME_KEY = "habernova-theme";

let store = null;

const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

document.addEventListener("DOMContentLoaded", initAdmin);

async function initAdmin() {
  applySavedTheme();
  bindAdminEvents();
  store = await loadStore();
  ensureStoreShape();
  renderAll();
  refreshIcons();
}

async function loadStore() {
  const local = readJson(STORAGE_KEY, null);
  if (local?.articles) return local;

  try {
    const response = await fetch("data.json", { cache: "no-store" });
    if (!response.ok) throw new Error("data.json okunamadı");
    return await response.json();
  } catch (error) {
    console.warn(error);
    return {
      site: { name: "HaberNova" },
      settings: { adsenseClient: "", newsletterCount: 0 },
      adSlots: [],
      users: [],
      articles: []
    };
  }
}

function ensureStoreShape() {
  store.settings ||= { adsenseClient: "", newsletterCount: 0 };
  store.adSlots ||= [
    { id: "banner", name: "Üst Banner", position: "banner", active: true, label: "Üst sponsor alanı" },
    { id: "sidebar", name: "Sidebar", position: "sidebar", active: true, label: "Yan kolon reklam alanı" },
    { id: "inline", name: "Makale İçi", position: "inline", active: true, label: "Makale içi sponsor alanı" }
  ];
  store.users ||= [
    { id: "editor-1", name: "Demo Editör", role: "Yönetici" }
  ];
  store.articles ||= [];
}

function bindAdminEvents() {
  qsa(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => showPanel(tab.dataset.panel));
  });

  qs("#theme-toggle")?.addEventListener("click", toggleTheme);
  qs("#new-article")?.addEventListener("click", clearArticleForm);
  qs("#clear-form")?.addEventListener("click", clearArticleForm);
  qs("#article-form")?.addEventListener("submit", saveArticle);
  qs("#ads-form")?.addEventListener("submit", saveAds);
  qs("#user-form")?.addEventListener("submit", saveUser);
  qs("#export-data")?.addEventListener("click", exportData);
  qs("#reset-data")?.addEventListener("click", resetData);
}

function renderAll() {
  renderDashboard();
  renderArticleTable();
  renderAdForm();
  renderUsers();
  fillEmptyArticleForm();
}

function showPanel(panelId) {
  qsa(".admin-panel").forEach((panel) => panel.classList.toggle("hidden-panel", panel.id !== panelId));
  qsa(".admin-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.panel === panelId));
}

function renderDashboard() {
  const comments = readJson(COMMENTS_KEY, {});
  const commentCount = Object.values(comments).reduce((total, list) => total + list.length, 0);
  const totalViews = store.articles.reduce((total, article) => total + Number(article.views || 0), 0);
  const activeAds = store.adSlots.filter((slot) => slot.active).length;
  const metrics = [
    ["Haber", store.articles.length],
    ["Toplam okuma", formatNumber(totalViews)],
    ["Yorum", commentCount],
    ["Aktif reklam", activeAds]
  ];

  qs("#metric-grid").innerHTML = metrics.map(([label, value]) => `
    <article class="metric-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `).join("");

  const top = [...store.articles].sort((a, b) => Number(b.views || 0) - Number(a.views || 0)).slice(0, 5);
  qs("#top-news-table").innerHTML = top.length ? top.map((article) => `
    <tr>
      <td>${escapeHtml(article.title)}</td>
      <td>${escapeHtml(article.category)}</td>
      <td>${formatNumber(article.views)}</td>
      <td>${article.featured ? "Slider" : "Yayında"}</td>
    </tr>
  `).join("") : `<tr><td colspan="4"><div class="empty-state">Henüz haber yok.</div></td></tr>`;
}

function renderArticleTable() {
  const table = qs("#articles-table");
  const articles = sortedArticles();
  table.innerHTML = articles.length ? articles.map((article) => `
    <tr>
      <td>
        <div class="table-title">
          <img src="${escapeAttr(article.image)}" alt="">
          <strong>${escapeHtml(article.title)}</strong>
        </div>
      </td>
      <td>${escapeHtml(article.category)}</td>
      <td>${formatDate(article.date)}</td>
      <td>${formatNumber(article.views)}</td>
      <td>
        <div class="table-actions">
          <button type="button" data-edit="${escapeAttr(article.id)}">Düzenle</button>
          <button class="delete" type="button" data-delete="${escapeAttr(article.id)}">Sil</button>
        </div>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="5"><div class="empty-state">İlk haberi formdan ekleyin.</div></td></tr>`;

  qsa("[data-edit]", table).forEach((button) => {
    button.addEventListener("click", () => editArticle(button.dataset.edit));
  });
  qsa("[data-delete]", table).forEach((button) => {
    button.addEventListener("click", () => deleteArticle(button.dataset.delete));
  });
}

function renderAdForm() {
  qs("#adsense-client").value = store.settings.adsenseClient || "";
  qs("#ad-admin-grid").innerHTML = store.adSlots.map((slot) => `
    <section class="mini-card" data-slot-card="${escapeAttr(slot.id)}">
      <h3>${escapeHtml(slot.name)}</h3>
      <label class="form-field">
        <span>Slot adı</span>
        <input data-slot-field="name" value="${escapeAttr(slot.name)}">
      </label>
      <label class="form-field">
        <span>Açıklama</span>
        <input data-slot-field="label" value="${escapeAttr(slot.label || "")}">
      </label>
      <label class="toggle-row">
        <input data-slot-field="active" type="checkbox" ${slot.active ? "checked" : ""}>
        <span>Aktif</span>
      </label>
    </section>
  `).join("");
}

function renderUsers() {
  qs("#users-grid").innerHTML = store.users.map((user) => `
    <article class="mini-card">
      <h3>${escapeHtml(user.name)}</h3>
      <p>${escapeHtml(user.role)}</p>
      <button class="danger-button" type="button" data-user-delete="${escapeAttr(user.id)}">Sil</button>
    </article>
  `).join("");

  qsa("[data-user-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      store.users = store.users.filter((user) => user.id !== button.dataset.userDelete);
      persist();
      renderUsers();
      renderDashboard();
      showToast("Kullanıcı silindi.");
    });
  });
}

function fillEmptyArticleForm() {
  if (qs("#article-id").value) return;
  qs("#article-read-time").value = 4;
  qs("#article-views").value = Math.floor(Math.random() * 6000) + 1200;
  qs("#article-author").value ||= "HaberNova Editörü";
}

function saveArticle(event) {
  event.preventDefault();
  const id = qs("#article-id").value || slugify(qs("#article-title").value);
  const existing = store.articles.find((article) => article.id === id);
  const article = {
    id,
    title: qs("#article-title").value.trim(),
    summary: qs("#article-summary").value.trim(),
    category: qs("#article-category").value,
    author: qs("#article-author").value.trim(),
    image: qs("#article-image").value.trim(),
    imageAlt: qs("#article-title").value.trim(),
    date: existing?.date || new Date().toISOString(),
    readTime: Number(qs("#article-read-time").value || 4),
    views: Number(qs("#article-views").value || 0),
    featured: qs("#article-featured").checked,
    breaking: qs("#article-breaking").checked,
    trending: qs("#article-trending").checked,
    tags: qs("#article-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
    content: qs("#article-content").value.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean)
  };

  if (!article.title || !article.summary || !article.image || !article.content.length) {
    showToast("Başlık, açıklama, görsel ve içerik zorunlu.");
    return;
  }

  const index = store.articles.findIndex((item) => item.id === id);
  if (index >= 0) {
    store.articles[index] = article;
  } else {
    store.articles.unshift(article);
  }

  persist();
  renderDashboard();
  renderArticleTable();
  clearArticleForm();
  showToast("Haber kaydedildi.");
}

function editArticle(id) {
  const article = store.articles.find((item) => item.id === id);
  if (!article) return;

  showPanel("news-panel");
  qs("#article-id").value = article.id;
  qs("#article-title").value = article.title || "";
  qs("#article-summary").value = article.summary || "";
  qs("#article-category").value = article.category || "Gündem";
  qs("#article-image").value = article.image || "";
  qs("#article-author").value = article.author || "";
  qs("#article-read-time").value = article.readTime || 4;
  qs("#article-tags").value = (article.tags || []).join(", ");
  qs("#article-views").value = article.views || 0;
  qs("#article-content").value = Array.isArray(article.content) ? article.content.join("\n\n") : article.content || "";
  qs("#article-featured").checked = Boolean(article.featured);
  qs("#article-breaking").checked = Boolean(article.breaking);
  qs("#article-trending").checked = Boolean(article.trending);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteArticle(id) {
  const article = store.articles.find((item) => item.id === id);
  if (!article) return;
  const confirmed = window.confirm(`"${article.title}" haberini silmek istiyor musunuz?`);
  if (!confirmed) return;
  store.articles = store.articles.filter((item) => item.id !== id);
  persist();
  renderDashboard();
  renderArticleTable();
  showToast("Haber silindi.");
}

function clearArticleForm() {
  qs("#article-form").reset();
  qs("#article-id").value = "";
  fillEmptyArticleForm();
}

function saveAds(event) {
  event.preventDefault();
  store.settings.adsenseClient = qs("#adsense-client").value.trim();
  qsa("[data-slot-card]").forEach((card) => {
    const slot = store.adSlots.find((item) => item.id === card.dataset.slotCard);
    if (!slot) return;
    slot.name = qs('[data-slot-field="name"]', card).value.trim();
    slot.label = qs('[data-slot-field="label"]', card).value.trim();
    slot.active = qs('[data-slot-field="active"]', card).checked;
  });
  persist();
  renderDashboard();
  renderAdForm();
  showToast("Reklam ayarları kaydedildi.");
}

function saveUser(event) {
  event.preventDefault();
  const name = qs("#user-name").value.trim();
  const role = qs("#user-role").value;
  if (!name) return;
  store.users.push({ id: slugify(`${name}-${Date.now()}`), name, role });
  persist();
  event.currentTarget.reset();
  renderUsers();
  showToast("Kullanıcı eklendi.");
}

function exportData() {
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "habernova-data.json";
  link.click();
  URL.revokeObjectURL(url);
}

function resetData() {
  const confirmed = window.confirm("LocalStorage verilerini silip data.json haline dönmek istiyor musunuz?");
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(COMMENTS_KEY);
  window.location.reload();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function sortedArticles() {
  return [...store.articles].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn(error);
    return fallback;
  }
}

function applySavedTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved || "light";
  document.documentElement.dataset.theme = theme;
  updateThemeIcon(theme);
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
  updateThemeIcon(next);
  refreshIcons();
}

function updateThemeIcon(theme) {
  qs("#theme-toggle i")?.setAttribute("data-lucide", theme === "dark" ? "sun" : "moon");
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(dateValue));
}

function formatNumber(value) {
  return new Intl.NumberFormat("tr-TR", { notation: "compact" }).format(Number(value || 0));
}

function slugify(value) {
  return String(value)
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `haber-${Date.now()}`;
}

function showToast(message) {
  const toast = qs("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function escapeAttr(value = "") {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
