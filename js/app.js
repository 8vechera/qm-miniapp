/* =========================================================================
   ЛОГИКА ПРИЛОЖЕНИЯ — трогать не обязательно.
   Всё содержимое берётся из data.js (объект STUDIO).
   ========================================================================= */

/* --- Инициализация Telegram Mini App --- */
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
if (tg) {
  tg.ready();
  tg.expand();                 // раскрыть на весь экран
  try { tg.setHeaderColor("#0d0d0f"); } catch (e) {}
  // ВАЖНО: иначе вертикальный свайп Telegram сворачивает окно вместо прокрутки страницы
  try { tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch (e) {}
}

/* Небольшая вибро-отдача при нажатии (только внутри Telegram) */
function haptic() {
  try { tg && tg.HapticFeedback.impactOccurred("light"); } catch (e) {}
}

/* Интро-заставка: после ухода прячем совсем (чтобы не перехватывала клики) */
(function splashCleanup() {
  const s = document.getElementById("splash");
  if (!s) return;
  setTimeout(() => s.classList.add("done"), 3200);
})();

/* --- Scroll-scrub: прогресс прокрутки -> в сцену (iframe) + затухание подсказки ---
   Сцена — фиксированный фон. Первый ~экран прокрутки гонит анимацию (разбор+поворот),
   дальше прогресс держится на 1 (разобранный объектив застыл фоном), контент наезжает. */
let heroUpdate = function () {};
const scroller = document.getElementById("scroll");   // собственный контейнер прокрутки (не window!)
(function heroScroll() {
  const frame = document.getElementById("hero-frame");
  const copy  = document.getElementById("hero-copy");
  const bgA = document.getElementById("bg-a");   // «Продакшн полного цикла» (вокруг модели)
  const bgB = document.getElementById("bg-b");   // «Ивенты · Подкасты · Live» (вертикаль по бокам)
  frame.src = "lens.html?v=8";

  let ticking = false;
  function update() {
    ticking = false;
    const range = Math.max(scroller.clientHeight, 1);   // анимация завершается за ~1 экран прокрутки
    const p = Math.min(Math.max(scroller.scrollTop / range, 0), 1);
    if (frame.contentWindow) frame.contentWindow.postMessage({ type: "heroProgress", p }, "*");
    copy.style.opacity = String(Math.max(0, 1 - p * 1.7));           // подсказка тает к ~середине

    // Фоновая типографика ПРОКРУЧИВАЕТСЯ (не тает): текст 1 уезжает вверх,
    // текст 2 приходит снизу в своё положение — как перелистывание. Дальше B остаётся.
    // Текст 2 приходит НЕМНОГО раньше (успевает встать на место к ~0.82 прогресса).
    if (bgA) bgA.style.transform = `translateY(${-p * 100}vh)`;
    if (bgB) bgB.style.transform = `translateY(${Math.max(0, 1 - p / 0.82) * 100}vh)`;
  }
  heroUpdate = update;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  scroller.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  frame.addEventListener("load", update);
  update();
})();

/* --- Строим превью-ссылку и embed-ссылку для видео --- */
function thumbUrl(item) {
  if (item.type === "youtube") return `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`;
  return ""; // для Vimeo превью грузится сложнее — оставляем чёрный фон с play
}
function embedUrl(item) {
  if (item.type === "youtube") return `https://www.youtube.com/embed/${item.id}?autoplay=1&rel=0`;
  if (item.type === "vimeo")   return `https://player.vimeo.com/video/${item.id}?autoplay=1`;
  return "";
}

/* --- Рендерим работы (ссылки на видео) --- */
const grid = document.getElementById("portfolio-grid");
STUDIO.portfolio.forEach(item => {
  const card = document.createElement("div");
  card.className = "project-card";
  const thumb = thumbUrl(item);
  card.innerHTML = `
    <div class="project-thumb" style="${thumb ? `background-image:url('${thumb}')` : ""}"></div>
    <div class="project-info">
      <div class="project-title">${escapeHtml(item.title)}</div>
      <div class="project-desc">${escapeHtml(item.description || "")}</div>
    </div>`;
  card.addEventListener("click", () => { haptic(); openVideo(item); });
  grid.appendChild(card);
});

/* --- Рендерим контакты (телефон + Telegram) --- */
document.getElementById("contacts-lead").textContent = STUDIO.contactsLead || "";
const contacts = document.getElementById("contacts");

if (STUDIO.managerPhone) {
  const telHref = "tel:" + STUDIO.managerPhone.replace(/[^\d+]/g, "");
  const a = document.createElement("a");
  a.className = "contact-card";
  a.href = telHref;
  a.innerHTML = `
    <span class="contact-ico">📞</span>
    <span class="contact-main">
      <span class="contact-label">Позвонить менеджеру</span>
      <span class="contact-value">${escapeHtml(STUDIO.managerPhone)}</span>
    </span>
    <span class="contact-arrow">›</span>`;
  a.addEventListener("click", haptic);
  contacts.appendChild(a);
}

if (STUDIO.managerUsername) {
  const btn = document.createElement("a");
  btn.className = "contact-card";
  btn.href = `https://t.me/${STUDIO.managerUsername}`;
  btn.innerHTML = `
    <span class="contact-ico">✈️</span>
    <span class="contact-main">
      <span class="contact-label">Написать в Telegram</span>
      <span class="contact-value">@${escapeHtml(STUDIO.managerUsername)}</span>
    </span>
    <span class="contact-arrow">›</span>`;
  btn.addEventListener("click", (e) => {
    haptic();
    if (tg && tg.openTelegramLink) { e.preventDefault(); tg.openTelegramLink(btn.href); }
  });
  contacts.appendChild(btn);
}

/* --- Модалка с видео --- */
const modal = document.getElementById("video-modal");
const videoWrap = document.getElementById("video-wrap");
function openVideo(item) {
  videoWrap.innerHTML = `<iframe src="${embedUrl(item)}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
  document.getElementById("video-title").textContent = item.title;
  document.getElementById("video-desc").textContent = item.description || "";
  modal.classList.remove("hidden");
}
function closeVideo() {
  modal.classList.add("hidden");
  videoWrap.innerHTML = ""; // остановить воспроизведение
}
document.getElementById("modal-close").addEventListener("click", closeVideo);
document.getElementById("modal-backdrop").addEventListener("click", closeVideo);

/* --- Переключение разделов (2 вкладки) --- */
const screens = { home: "screen-home", contacts: "screen-contacts" };
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    haptic();
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    Object.values(screens).forEach(id => document.getElementById(id).classList.add("hidden"));
    document.getElementById(screens[tab.dataset.screen]).classList.remove("hidden");
    document.body.dataset.screen = tab.dataset.screen;   // фон главного экрана виден только на «Работах»
    scroller.scrollTo(0, 0);
    heroUpdate();                 // пересинхронизировать 3D-фон (актуально при возврате на «Работы»)
    setOrderButton(tab.dataset.screen === "contacts");   // «Обсудить проект» — только в Контактах
  });
});

/* --- Кнопка "Обсудить проект" — ведёт в личку менеджера.
   Показывается ТОЛЬКО в разделе «Контакты» (см. setOrderButton в переключении вкладок). */
function openManagerChat() {
  const url = `https://t.me/${STUDIO.managerUsername}`;
  if (tg && tg.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, "_blank");
}
let fallbackOrderBtn = null;
if (tg && tg.MainButton) {
  tg.MainButton.setText(STUDIO.orderButtonText);
  tg.MainButton.color = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#E5573F";
  tg.MainButton.onClick(openManagerChat);
  // НЕ показываем сразу — включим только на «Контактах»
} else {
  /* Вне Telegram (браузер) — своя кнопка снизу, изначально скрыта */
  fallbackOrderBtn = document.createElement("button");
  fallbackOrderBtn.textContent = STUDIO.orderButtonText;
  fallbackOrderBtn.style.cssText =
    "position:fixed;left:16px;right:16px;bottom:calc(var(--tabbar-h) + 12px);z-index:45;display:none;" +
    "padding:14px;border:none;border-radius:12px;font-size:15px;font-weight:600;" +
    "background:var(--accent);color:#fff;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.4);";
  fallbackOrderBtn.addEventListener("click", openManagerChat);
  document.body.appendChild(fallbackOrderBtn);
}
/* Показать/скрыть кнопку заказа (нативную MainButton или запасную) */
function setOrderButton(visible) {
  if (tg && tg.MainButton) { visible ? tg.MainButton.show() : tg.MainButton.hide(); }
  else if (fallbackOrderBtn) { fallbackOrderBtn.style.display = visible ? "block" : "none"; }
}

/* Утилита: экранируем текст, чтобы не сломать вёрстку и не было XSS */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
