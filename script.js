"use strict";

const STORAGE_KEY = "habernova-store";
const COMMENTS_KEY = "habernova-comments";
const THEME_KEY = "habernova-theme";

const fallbackData = {
  site: {
    name: "HaberNova",
    description: "Modern, hızlı ve reklam gelirine hazır haber sitesi."
  },
  settings: {
    adsenseClient: "",
    newsletterCount: 0
  },
  adSlots: [
    { id: "banner", name: "Üst Banner", position: "banner", active: true, label: "Üst sponsor alanı" },
    { id: "sidebar", name: "Sidebar", position: "sidebar", active: true, label: "Yan kolon reklam alanı" },
    { id: "inline", name: "Makale İçi", position: "inline", active: true, label: "Makale içi sponsor alanı" }
  ],
  articles: [
    {
      id: "gundem-yeni-donem",
      title: "Büyükşehirlerde ulaşım için yeni dönem başladı",
      summary: "Akıllı bilet, yoğunluk haritası ve hızlı aktarma modeliyle kent içi ulaşımda yeni uygulama devreye giriyor.",
      category: "Gündem",
      author: "Ayşe Demir",
      image: "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1400&q=80",
      imageAlt: "Gazete ve şehir gündemi",
      date: "2026-05-06T09:30:00+03:00",
      readTime: 4,
      views: 18420,
      featured: true,
      breaking: true,
      trending: true,
      tags: ["ulaşım", "gündem", "şehir"],
      content: [
        "Büyükşehirlerde toplu ulaşımı hızlandırmak için hazırlanan yeni entegrasyon modeli bugün itibarıyla kademeli olarak uygulanmaya başladı.",
        "Model; hat yoğunluğu, aktarma süreleri ve anlık yolcu akışı gibi verileri tek panelde toplayarak belediyelere daha hızlı karar alma imkanı sunuyor.",
        "Uzmanlara göre sistemin başarısı, açık veri paylaşımı ve mobil uygulama deneyiminin sade tutulmasına bağlı olacak."
      ]
    }
  ]
};

const state = {
  data: null,
  articles: [],
  activeCategory: "Tümü",
  searchTerm: "",
  currentSlide: 0,
  sliderTimer: null
};

const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  applySavedTheme();
  bindGlobalEvents();
  state.data = await loadData();
  state.articles = normalizeArticles(state.data.articles);
  renderDate();
  renderAds();
  renderHome();
  routeFromUrl();
  refreshIcons();
}

async function loadData() {
  const stored = readJson(STORAGE_KEY, null);
  if (stored?.articles?.length) return stored;

  try {
    const response = await fetch("data.json", { cache: "no-store" });
    if (!response.ok) throw new Error("data.json okunamadı");
    return await response.json();
  } catch (error) {
    console.warn(error);
    return fallbackData;
  }
}

function normalizeArticles(articles = []) {
  return articles
    .map((article) => ({
      ...article,
      views: Number(article.views || 0),
      readTime: Number(article.readTime || 3),
      content: Array.isArray(article.content)
        ? article.content
        : String(article.content || "").split(/\n+/).filter(Boolean),
      tags: Array.isArray(article.tags)
        ? article.tags
        : String(article.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean)
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function bindGlobalEvents() {
  qs("#theme-toggle")?.addEventListener("click", toggleTheme);
  qs("#site-search")?.addEventListener("input", (event) => {
    state.searchTerm = event.target.value.trim().toLocaleLowerCase("tr-TR");
    renderNewsGrid();
  });

  qsa("[data-category]").forEach((button) => {
    button.addEventListener("click", () => setCategory(button.dataset.category));
  });

  qs("#prev-slide")?.addEventListener("click", () => changeSlide(-1));
  qs("#next-slide")?.addEventListener("click", () => changeSlide(1));
  qs("#back-home")?.addEventListener("click", () => {
    history.pushState({}, "", "index.html");
    showHome();
  });

  qs("#newsletter-form")?.addEventListener("submit", handleNewsletter);
  window.addEventListener("popstate", routeFromUrl);
}

function renderDate() {
  const dateEl = qs("#current-date");
  if (!dateEl) return;
  dateEl.textContent = new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());
}

function renderHome() {
  renderBreaking();
  renderSlider();
  renderTrending();
  renderBriefing();
  renderNewsGrid();
}

function renderBreaking() {
  const ticker = qs("#breaking-ticker");
  if (!ticker) return;
  const breaking = state.articles.filter((article) => article.breaking).slice(0, 6);
  ticker.innerHTML = breaking.map((article) => (
    `<a href="${articleUrl(article)}">${escapeHtml(article.title)}</a>`
  )).join("");
}

function renderSlider() {
  const shell = qs("#slider-shell");
  const dots = qs("#slider-dots");
  if (!shell || !dots) return;

  const featured = getFeaturedArticles();
  shell.innerHTML = featured.map((article, index) => `
    <article class="slide ${index === state.currentSlide ? "active" : ""}">
      <img src="${escapeAttr(article.image)}" alt="${escapeAttr(article.imageAlt || article.title)}" loading="${index === 0 ? "eager" : "lazy"}">
      <div class="slide__content">
        <span class="kicker">${escapeHtml(article.category)} · ${formatDate(article.date)}</span>
        <h1>${escapeHtml(article.title)}</h1>
        <p>${escapeHtml(article.summary)}</p>
        <a class="read-more" href="${articleUrl(article)}">
          Haberi oku
          <i data-lucide="arrow-right" aria-hidden="true"></i>
        </a>
      </div>
    </article>
  `).join("");

  dots.innerHTML = featured.map((article, index) => `
    <button class="${index === state.currentSlide ? "active" : ""}" type="button" aria-label="${index + 1}. haber" data-slide="${index}"></button>
  `).join("");

  qsa("[data-slide]", dots).forEach((dot) => {
    dot.addEventListener("click", () => {
      state.currentSlide = Number(dot.dataset.slide);
      renderSlider();
      restartSlider();
    });
  });

  restartSlider();
  refreshIcons();
}

function getFeaturedArticles() {
  const featured = state.articles.filter((article) => article.featured);
  return (featured.length ? featured : state.articles).slice(0, 4);
}

function changeSlide(direction) {
  const featured = getFeaturedArticles();
  state.currentSlide = (state.currentSlide + direction + featured.length) % featured.length;
  renderSlider();
}

function restartSlider() {
  clearInterval(state.sliderTimer);
  const featured = getFeaturedArticles();
  if (featured.length < 2) return;
  state.sliderTimer = setInterval(() => changeSlide(1), 6500);
}

function renderTrending() {
  const list = qs("#trend-list");
  if (!list) return;
  const trending = [...state.articles]
    .filter((article) => article.trending)
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);
  list.innerHTML = trending.map(compactArticleTemplate).join("");
}

function renderBriefing() {
  const list = qs("#briefing-list");
  if (!list) return;
  list.innerHTML = state.articles.slice(0, 4).map(compactArticleTemplate).join("");
}

function renderNewsGrid() {
  const grid = qs("#news-grid");
  if (!grid) return;

  const articles = getFilteredArticles();
  grid.innerHTML = articles.length
    ? articles.map(articleCardTemplate).join("")
    : `<div class="empty-state">Aradığınız kriterlere uygun haber bulunamadı.</div>`;
  refreshIcons();
}

function getFilteredArticles() {
  return state.articles.filter((article) => {
    const categoryMatch = state.activeCategory === "Tümü" || article.category === state.activeCategory;
    const haystack = `${article.title} ${article.summary} ${article.category} ${(article.tags || []).join(" ")}`.toLocaleLowerCase("tr-TR");
    const searchMatch = !state.searchTerm || haystack.includes(state.searchTerm);
    return categoryMatch && searchMatch;
  });
}

function articleCardTemplate(article) {
  return `
    <article class="news-card">
      <a class="news-card__image" href="${articleUrl(article)}">
        <img src="${escapeAttr(article.image)}" alt="${escapeAttr(article.imageAlt || article.title)}" loading="lazy">
        <span class="badge">${escapeHtml(article.category)}</span>
      </a>
      <div class="news-card__body">
        <div class="meta">
          <span>${formatDate(article.date)}</span>
          <span>·</span>
          <span>${article.readTime} dk okuma</span>
        </div>
        <h2><a href="${articleUrl(article)}">${escapeHtml(article.title)}</a></h2>
        <p>${escapeHtml(article.summary)}</p>
        <div class="card-footer">
          <span class="meta">${formatNumber(article.views)} okuma</span>
          <a class="read-more" href="${articleUrl(article)}">
            Oku
            <i data-lucide="arrow-right" aria-hidden="true"></i>
          </a>
        </div>
      </div>
    </article>
  `;
}

function compactArticleTemplate(article) {
  return `
    <a class="trend-item" href="${articleUrl(article)}">
      <img src="${escapeAttr(article.image)}" alt="${escapeAttr(article.imageAlt || article.title)}" loading="lazy">
      <span>
        <strong>${escapeHtml(article.title)}</strong>
        <span class="meta">${escapeHtml(article.category)} · ${formatNumber(article.views)} okuma</span>
      </span>
    </a>
  `;
}

function setCategory(category) {
  state.activeCategory = category || "Tümü";
  qsa("[data-category]").forEach((button) => {
    button.classList.toggle("active", button.dataset.category === state.activeCategory);
  });
  const url = new URL(window.location.href);
  if (state.activeCategory === "Tümü") {
    url.searchParams.delete("category");
  } else {
    url.searchParams.set("category", state.activeCategory);
    url.searchParams.delete("id");
  }
  history.replaceState({}, "", url);
  showHome();
  renderNewsGrid();
}

function routeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const category = params.get("category");
  const articleId = params.get("id");

  if (category) {
    state.activeCategory = category;
    qsa("[data-category]").forEach((button) => {
      button.classList.toggle("active", button.dataset.category === category);
    });
  }

  if (articleId) {
    renderArticle(articleId);
  } else {
    showHome();
    renderNewsGrid();
  }
}

function renderArticle(articleId) {
  const article = state.articles.find((item) => item.id === articleId);
  if (!article) {
    showToast("Haber bulunamadı.");
    showHome();
    return;
  }

  const comments = readComments()[article.id] || [];
  const articleMain = qs("#article-main");
  const related = getRelatedArticles(article);

  document.title = `${article.title} | HaberNova`;
  updateMeta("description", article.summary);
  updateMeta("og:title", article.title, "property");
  updateMeta("og:description", article.summary, "property");
  updateMeta("og:image", article.image, "property");

  articleMain.innerHTML = `
    <img class="article-hero" src="${escapeAttr(article.image)}" alt="${escapeAttr(article.imageAlt || article.title)}">
    <div class="article-content">
      <span class="kicker">${escapeHtml(article.category)} · ${formatDate(article.date)}</span>
      <h1 class="article-title">${escapeHtml(article.title)}</h1>
      <p class="article-summary">${escapeHtml(article.summary)}</p>
      <div class="meta">
        <span>${escapeHtml(article.author || "HaberNova")}</span>
        <span>·</span>
        <span>${article.readTime} dk okuma</span>
        <span>·</span>
        <span>${formatNumber(article.views)} okuma</span>
      </div>
      <div class="share-row">
        <button type="button" data-share="native">Paylaş</button>
        <a href="${shareUrl("x", article)}" target="_blank" rel="noopener">X</a>
        <a href="${shareUrl("facebook", article)}" target="_blank" rel="noopener">Facebook</a>
        <a href="${shareUrl("whatsapp", article)}" target="_blank" rel="noopener">WhatsApp</a>
      </div>
      <section class="ad-slot ad-slot--inline" data-ad-position="inline">
        <span>Reklam</span>
        <strong>Makale İçi Reklam</strong>
      </section>
      <div class="article-body">
        ${article.content.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
      </div>
      <div class="comment-box">
        <h2>Yorumlar</h2>
        <form class="comment-form" id="comment-form">
          <input name="name" type="text" placeholder="Adınız" maxlength="60" required>
          <textarea name="message" placeholder="Yorumunuz" maxlength="500" required></textarea>
          <button type="submit">Yorum gönder</button>
        </form>
        <div class="comment-list" id="comment-list">
          ${comments.length ? comments.map(commentTemplate).join("") : `<div class="empty-state">İlk yorumu siz yazın.</div>`}
        </div>
      </div>
    </div>
  `;

  qs("#related-news").innerHTML = related.map((item) => `
    <a class="related-item" href="${articleUrl(item)}">
      <img src="${escapeAttr(item.image)}" alt="${escapeAttr(item.imageAlt || item.title)}" loading="lazy">
      <span>
        <strong>${escapeHtml(item.title)}</strong>
        <span class="meta">${escapeHtml(item.category)} · ${formatDate(item.date)}</span>
      </span>
    </a>
  `).join("");

  qs('[data-share="native"]')?.addEventListener("click", () => shareNative(article));
  qs("#comment-form")?.addEventListener("submit", (event) => handleComment(event, article));

  qs("#home-view")?.classList.add("hidden");
  qs("#article-view")?.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
  renderAds();
}

function showHome() {
  document.title = "HaberNova | Son Dakika ve Güncel Haberler";
  updateMeta("description", "HaberNova - Son dakika, gündem, ekonomi, teknoloji ve spor haberleri için hızlı, mobil uyumlu ve SEO odaklı haber sitesi.");
  qs("#home-view")?.classList.remove("hidden");
  qs("#article-view")?.classList.add("hidden");
}

function getRelatedArticles(article) {
  return state.articles
    .filter((item) => item.id !== article.id && item.category === article.category)
    .slice(0, 4);
}

function handleComment(event, article) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const comment = {
    name: String(formData.get("name") || "").trim(),
    message: String(formData.get("message") || "").trim(),
    date: new Date().toISOString()
  };

  if (!comment.name || !comment.message) return;

  const allComments = readComments();
  allComments[article.id] = [comment, ...(allComments[article.id] || [])];
  writeJson(COMMENTS_KEY, allComments);
  form.reset();
  qs("#comment-list").innerHTML = allComments[article.id].map(commentTemplate).join("");
  showToast("Yorum kaydedildi.");
}

function commentTemplate(comment) {
  return `
    <article class="comment">
      <strong>${escapeHtml(comment.name)}</strong>
      <span>${formatDate(comment.date)}</span>
      <p>${escapeHtml(comment.message)}</p>
    </article>
  `;
}

function handleNewsletter(event) {
  event.preventDefault();
  const store = state.data;
  store.settings = store.settings || {};
  store.settings.newsletterCount = Number(store.settings.newsletterCount || 0) + 1;
  writeJson(STORAGE_KEY, store);
  event.currentTarget.reset();
  showToast("E-posta kaydı alındı.");
}

function renderAds() {
  const slots = state.data?.adSlots || [];
  qsa("[data-ad-position]").forEach((slotEl) => {
    const slot = slots.find((item) => item.position === slotEl.dataset.adPosition && item.active);
    if (!slot) {
      slotEl.classList.add("hidden");
      return;
    }
    slotEl.classList.remove("hidden");
    slotEl.innerHTML = `
      <span>Reklam</span>
      <strong>${escapeHtml(slot.name)}</strong>
      <small>${escapeHtml(slot.label || "Sponsor alanı")}</small>
    `;
  });

  const client = state.data?.settings?.adsenseClient;
  if (client && client.startsWith("ca-pub-") && !qs("#adsense-loader")) {
    const script = document.createElement("script");
    script.id = "adsense-loader";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    document.head.appendChild(script);
  }
}

function shareNative(article) {
  const shareData = {
    title: article.title,
    text: article.summary,
    url: new URL(articleUrl(article), window.location.href).href
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
    return;
  }

  navigator.clipboard?.writeText(shareData.url);
  showToast("Haber bağlantısı kopyalandı.");
}

function shareUrl(network, article) {
  const url = encodeURIComponent(new URL(articleUrl(article), window.location.href).href);
  const text = encodeURIComponent(article.title);
  const urls = {
    x: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    whatsapp: `https://wa.me/?text=${text}%20${url}`
  };
  return urls[network] || "#";
}

function articleUrl(article) {
  return `index.html?id=${encodeURIComponent(article.id)}`;
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

function readComments() {
  return readJson(COMMENTS_KEY, {});
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

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
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

function updateMeta(name, content, attr = "name") {
  const element = qs(`meta[${attr}="${name}"]`);
  if (element) element.setAttribute("content", content);
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
