/* =========================================================================
   ЛОГИКА ПРИЛОЖЕНИЯ — трогать не обязательно.
   Всё содержимое берётся из data.js (объект STUDIO).
   ========================================================================= */

/* --- Инициализация Telegram Mini App --- */
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
// В обычном браузере SDK тоже создаёт объект WebApp, но без initData — считаем это «не в Telegram»
const inTelegram = !!(tg && tg.initData);
if (inTelegram) {
  tg.ready();
  tg.expand();                 // раскрыть на весь экран
  try { tg.setHeaderColor("#0d0d0f"); } catch (e) {}
  // ВАЖНО: иначе вертикальный свайп Telegram сворачивает окно вместо прокрутки страницы
  try { tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch (e) {}
}

/* Небольшая вибро-отдача при нажатии (только внутри Telegram) */
function haptic() {
  try { inTelegram && tg.HapticFeedback.impactOccurred("light"); } catch (e) {}
}
/* Отдача при выборе варианта (мягче, чем haptic) */
function hapticSelect() {
  try { inTelegram && tg.HapticFeedback.selectionChanged(); } catch (e) {}
}

/* Интро-заставка: после ухода прячем совсем (чтобы не перехватывала клики) */
(function splashCleanup() {
  const s = document.getElementById("splash");
  if (!s) return;
  setTimeout(() => s.classList.add("done"), 3200);
})();

/* Метки «ДЕМО» и полоска прототипа — пока в data.js не сказано обратного */
if (STUDIO.showDemoBanner) document.querySelectorAll(".demo-banner").forEach(b => b.hidden = false);
if (STUDIO.processDemo)  document.getElementById("process-demo").hidden = false;
if (STUDIO.examplesDemo) document.getElementById("examples-demo").hidden = false;
if (STUDIO.faqDemo)      document.getElementById("faq-demo").hidden = false;
const demoTag = '<span class="demo-tag">ДЕМО</span>';

/* --- Scroll-scrub: прогресс прокрутки -> в сцену (iframe) + затухание подсказки ---
   Сцена — фиксированный фон. Первый ~экран прокрутки гонит анимацию (разбор+поворот),
   дальше прогресс держится на 1 (разобранный объектив застыл фоном).
   Кейсы наезжают раньше — с середины анимации (см. fitSpacer). */
let heroUpdate = function () {};
const scroller = document.getElementById("scroll");   // собственный контейнер прокрутки (не window!)
(function heroScroll() {
  const frame = document.getElementById("hero-frame");
  const copy  = document.getElementById("hero-copy");
  const bgA = document.getElementById("bg-a");   // «Продакшн полного цикла» (вокруг модели)
  const spacer = document.querySelector(".hero-spacer");
  frame.src = "lens.html?v=17";

  // Высота пустой зоны над кейсами. Кейсы выходят из-под меню ровно тогда, когда «ПОЛНОГО»
  // скрылось под логотипом и сверху осталось одно «ЦИКЛА». Текст едет 1:1 с прокруткой,
  // поэтому считаем по его положению на этом экране (размер шрифта зависит от ширины).
  function fitSpacer() {
    const word = bgA && bgA.querySelector(".a2");
    if (!word || !word.offsetHeight) return;   // фон скрыт (другая вкладка) — мерить нечего
    const fs = parseFloat(getComputedStyle(word).fontSize);
    const wordBottom = word.offsetTop + word.offsetHeight / 2 + 0.81 * fs;    // низ букв: прописные Oswald 0.81em, ×2 от scaleY
    const underLogo = document.getElementById("brand").offsetHeight * 0.62;   // тут плашка логотипа уже непрозрачна
    const menuTop = scroller.clientHeight - document.querySelector(".tabbar").offsetHeight;
    const spacerTop = spacer.getBoundingClientRect().top + scroller.scrollTop;
    spacer.style.height = Math.round(wordBottom - underLogo + menuTop - spacerTop) + "px";
  }

  let ticking = false;
  function update() {
    ticking = false;
    if (document.body.dataset.screen !== "home") return;   // на «Связи» фон скрыт
    const range = Math.max(scroller.clientHeight, 1);   // анимация завершается за ~1 экран прокрутки
    const p = Math.min(Math.max(scroller.scrollTop / range, 0), 1);
    if (frame.contentWindow) frame.contentWindow.postMessage({ type: "heroProgress", p }, "*");
    copy.style.opacity = String(Math.max(0, 1 - p * 1.7));           // подсказка тает к ~середине

    // Фоновая типографика ПРОКРУЧИВАЕТСЯ (не тает): уезжает вверх ровно вместе с прокруткой.
    if (bgA) bgA.style.transform = `translateY(${-p * range}px)`;
  }
  heroUpdate = function () { fitSpacer(); update(); };
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  scroller.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { fitSpacer(); onScroll(); });
  frame.addEventListener("load", update);
  heroUpdate();
})();

/* =========================================================================
   СВЯЗЬ С МЕНЕДЖЕРОМ — без бэкенда.
   Ссылка t.me/<ник>?text=<черновик> открывает личку менеджера, и текст уже
   стоит в поле ввода: клиенту остаётся нажать «Отправить».
   На всякий случай текст ещё и копируется в буфер (если клиент Telegram
   не подставит черновик — его можно вставить вручную).
   ========================================================================= */
function managerUrl(text) {
  const base = `https://t.me/${STUDIO.managerUsername}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true, () => copyFallback(text));
    }
  } catch (e) {}
  return Promise.resolve(copyFallback(text));
}
function copyFallback(text) {            // старый способ: через скрытое поле
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch (e) { return false; }
}
function sendToManager(text) {
  haptic();
  const url = managerUrl(text);
  if (text) copyText(text).then(ok => { if (ok) toast("Открываем чат · текст скопирован на всякий случай"); });
  if (tg && tg.openTelegramLink && inTelegram) tg.openTelegramLink(url);
  else window.open(url, "_blank");
}

/* Всплывающая подсказка внизу экрана */
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

/* =========================================================================
   НИЖНЯЯ КНОПКА ДЕЙСТВИЯ («Обсудить проект» на «Связи»):
   в Telegram — нативная MainButton, в браузере — своя.
   ========================================================================= */
let ctaHandler = null;
let fallbackCta = null;
if (inTelegram && tg.MainButton) {
  tg.MainButton.color = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#E5573F";
  tg.MainButton.textColor = "#ffffff";
  tg.MainButton.onClick(() => { if (ctaHandler) ctaHandler(); });
} else {
  /* Вне Telegram (браузер) — своя кнопка снизу, изначально скрыта */
  fallbackCta = document.createElement("button");
  fallbackCta.className = "fallback-cta";
  fallbackCta.addEventListener("click", () => { if (ctaHandler) ctaHandler(); });
  document.body.appendChild(fallbackCta);
}
function setCta(text, handler) {
  ctaHandler = handler;
  if (fallbackCta) {
    fallbackCta.textContent = text; fallbackCta.style.display = "block";
    document.body.classList.add("has-cta");          // место под свою кнопку (нативная — вне страницы)
  }
  else if (inTelegram) { tg.MainButton.setText(text); tg.MainButton.show(); }
}
function hideCta() {
  ctaHandler = null;
  if (fallbackCta) fallbackCta.style.display = "none";
  else if (inTelegram) tg.MainButton.hide();
  document.body.classList.remove("has-cta");
}

/* НАТИВНАЯ КНОПКА «НАЗАД» в шапке Telegram — закрывает лист кейса. */
let backHandler = null;
if (inTelegram && tg.BackButton) tg.BackButton.onClick(() => { if (backHandler) backHandler(); });
function setBack(handler) {
  backHandler = handler;
  if (!inTelegram || !tg.BackButton) return;
  try { handler ? tg.BackButton.show() : tg.BackButton.hide(); } catch (e) {}
}

/* --- Утилиты --- */
const rub = n => new Intl.NumberFormat("ru-RU").format(n) + " ₽";
function scrollToEl(el) {
  const top = el.getBoundingClientRect().top + scroller.scrollTop - 140;   // 140 — под фикс-логотипом
  scroller.scrollTo({ top, behavior: "smooth" });
}

/* --- Превью и embed-ссылка для видео --- */
function thumbUrl(item) {
  if (item.type === "youtube" && item.id) return `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`;
  return ""; // для Vimeo и кейсов без видео — тёмная заглушка
}
function embedUrl(item) {
  if (item.type === "youtube") return `https://www.youtube.com/embed/${item.id}?autoplay=1&rel=0`;
  if (item.type === "vimeo")   return `https://player.vimeo.com/video/${item.id}?autoplay=1`;
  return "";
}

/* =========================================================================
   КАЛЬКУЛЯТОР: подсчёт цены (экраны калькулятора — ниже)
   ========================================================================= */
const CALC = STUDIO.calculator;
const BRANCHES = ["podcast", "event"].filter(id => CALC[id]);

/* Цена для конкретного набора ответов. answers[key] = индекс варианта (single)
   или массив индексов (multi). */
function priceOf(branchId, answers) {
  const br = CALC[branchId];
  let units = 1, perUnit = 0, add = 0, mult = 1;
  br.steps.forEach(st => {
    const a = answers[st.key];
    const picked = st.kind === "multi" ? (a || []) : (a === undefined ? [] : [a]);
    picked.forEach(i => {
      const o = st.options[i];
      if (o.units)   units = o.units;
      if (o.perUnit) perUnit += o.perUnit;
      if (o.add)     add += o.add;
      if (o.mult)    mult *= o.mult;
    });
  });
  const total = (perUnit * units + add) * mult;
  return Math.floor(total / CALC.roundTo) * CALC.roundTo;
}

/* «от X ₽»: минимум по всем ещё не выбранным вопросам (перебор — вариантов мало).
   Так цифра честная: дешевле при уже выбранных параметрах не получится. */
function minPrice(branchId, answers) {
  const br = CALC[branchId];
  const open = br.steps.filter(st => st.kind === "single" && answers[st.key] === undefined);
  let best = Infinity;
  (function walk(i, acc) {
    if (i === open.length) { best = Math.min(best, priceOf(branchId, acc)); return; }
    open[i].options.forEach((_, idx) => walk(i + 1, { ...acc, [open[i].key]: idx }));
  })(0, { ...answers });
  return best;
}

/* Ответы, записанные ТЕКСТОМ (как в data.js → examples), переводим в номера вариантов */
function answersFromPick(branchId, pick) {
  const answers = {};
  CALC[branchId].steps.forEach(st => {
    const want = pick[st.key];
    if (want === undefined) return;
    const idx = label => {
      const i = st.options.findIndex(o => o.label === label);
      if (i < 0) console.warn(`[data.js → examples] нет варианта «${label}» в вопросе «${st.q}»`);
      return i;
    };
    if (st.kind === "multi") answers[st.key] = [].concat(want).map(idx).filter(i => i >= 0).sort();
    else { const i = idx(want); if (i >= 0) answers[st.key] = i; }
  });
  return answers;
}

/* Ответы в виде строк «Подпись: вариант» (для итога, брифа и примеров) */
function answerLines(branchId, answers) {
  return CALC[branchId].steps.map(st => {
    const a = answers[st.key];
    const picked = st.kind === "multi" ? (a || []) : (a === undefined ? [] : [a]);
    if (!picked.length) return st.kind === "multi" ? null : `${st.short || st.q}: —`;
    return `${st.short || st.q}: ${picked.map(i => st.options[i].label).join(", ")}`;
  }).filter(Boolean);
}

/* =========================================================================
   КЕЙСЫ: сразу 1 подкаст + 1 мероприятие, остальные — «Смотреть больше»
   ========================================================================= */
const TAG_NAMES = { podcast: "Подкаст", event: "Мероприятие" };
function caseCard(item) {
  const card = document.createElement("button");
  card.className = "project-card" + (item.demo ? " is-demo" : "");
  const thumb = thumbUrl(item);
  card.innerHTML = `
    <div class="project-thumb${thumb ? "" : " no-video"}">
      ${thumb ? `<img src="${thumb}" alt="" loading="lazy" decoding="async">` : `<span class="thumb-empty">${item.demo ? "ДЕМО-кейс" : "Видео скоро"}</span>`}
      ${item.tag ? `<span class="thumb-tag">${TAG_NAMES[item.tag] || ""}</span>` : ""}
    </div>
    <div class="project-info">
      <div class="project-title">${escapeHtml(item.title)}</div>
      <div class="project-desc">${escapeHtml(item.client || "")}</div>
      ${item.metrics && item.metrics.length ? `<div class="metrics">${item.metrics.map(m => `<span class="metric">${escapeHtml(m)}</span>`).join("")}</div>` : ""}
    </div>`;
  card.addEventListener("click", () => { haptic(); openCase(item); });
  return card;
}
(function renderCases() {
  const main = document.getElementById("cases-main");
  const more = document.getElementById("cases-more");
  const toggle = document.getElementById("cases-toggle");
  const featured = [STUDIO.cases.find(c => c.tag === "podcast"), STUDIO.cases.find(c => c.tag === "event")].filter(Boolean);
  const rest = STUDIO.cases.filter(c => !featured.includes(c));
  featured.forEach(c => main.appendChild(caseCard(c)));
  rest.forEach(c => more.appendChild(caseCard(c)));
  if (!rest.length) return;

  const moreText = "Смотреть больше ↓";
  toggle.textContent = moreText;
  toggle.hidden = false;
  toggle.addEventListener("click", () => {
    haptic();
    const open = more.hidden;
    more.hidden = !open;
    toggle.textContent = open ? "Свернуть ↑" : moreText;
    if (!open) scrollToEl(document.getElementById("cases-title"));   // свернули — вернуться к началу кейсов
  });
})();

/* --- Как мы работаем --- */
document.getElementById("process").innerHTML = STUDIO.process
  .map((p, i) => `<li><span class="process-n">${i + 1}</span><span><b>${escapeHtml(p.title)}</b><br>${escapeHtml(p.text)}</span></li>`)
  .join("");

/* --- Лист кейса: видео + детали + «Хочу так же» / «Спросить» --- */
const modal = document.getElementById("video-modal");
const videoWrap = document.getElementById("video-wrap");
let openedCase = null;
function openCase(item) {
  openedCase = item;
  videoWrap.innerHTML = item.id
    ? `<iframe src="${embedUrl(item)}" allow="autoplay; fullscreen" allowfullscreen></iframe>`
    : `<div class="video-empty">${item.demo ? "Это демо-кейс: здесь будет видео проекта" : "Видео скоро"}</div>`;
  document.getElementById("video-title").textContent = item.title;
  document.getElementById("video-desc").textContent = item.client || "";

  const parts = [];
  if (item.metrics && item.metrics.length) parts.push(`<div class="metrics">${item.metrics.map(m => `<span class="metric">${escapeHtml(m)}</span>`).join("")}</div>`);
  if (item.task) parts.push(`<div class="case-block"><div class="case-label">Задача</div><p>${escapeHtml(item.task)}</p></div>`);
  if (item.done) parts.push(`<div class="case-block"><div class="case-label">Что сделали</div><p>${escapeHtml(item.done)}</p></div>`);
  if (item.backstage && item.backstage.length) parts.push(`<div class="case-block"><div class="case-label">За кадром</div><ul class="backstage">${item.backstage.map(b => `<li>${escapeHtml(b)}</li>`).join("")}</ul></div>`);
  document.getElementById("case-details").innerHTML = parts.join("");

  modal.classList.remove("hidden");
  setBack(closeVideo);
}
function closeVideo() {
  modal.classList.add("hidden");
  videoWrap.innerHTML = ""; // остановить воспроизведение
  openedCase = null;
  setBack(null);
}
document.getElementById("modal-close").addEventListener("click", closeVideo);
document.getElementById("modal-backdrop").addEventListener("click", closeVideo);
document.getElementById("case-want").addEventListener("click", () => {
  if (!openedCase) return;
  const tag = openedCase.tag ? `#кейс_${openedCase.tag === "event" ? "мероприятие" : "подкаст"}` : "#кейс";
  sendToManager(`Здравствуйте! Интересует проект как в кейсе «${openedCase.title}» (из мини-аппа QM). Расскажете, как это может выглядеть у нас?\n\n${tag}`);
});
document.getElementById("case-ask").addEventListener("click", () => {
  if (!openedCase) return;
  sendToManager(`Здравствуйте! Вопрос по кейсу «${openedCase.title}» из мини-аппа QM: `);
});

/* =========================================================================
   РАСЧЁТ ПРОЕКТА: калькулятор-бриф прямо на главной, по шагам
   Шаг 0 — выбор направления, шаги 1..N — вопросы ветки, N+1 — итог.
   Состояние сохраняется: клиент может уйти и вернуться к недособранному брифу.
   ========================================================================= */
const STORE_KEY = "qm_calc_v1";
let calc = { branch: null, step: 0, answers: {}, comment: "" };

const store = {
  save() {
    const s = JSON.stringify(calc);
    try { localStorage.setItem(STORE_KEY, s); } catch (e) {}
    try { if (inTelegram && tg.CloudStorage && tg.isVersionAtLeast("6.9")) tg.CloudStorage.setItem(STORE_KEY, s); } catch (e) {}
  },
  load(done) {
    let s = null;
    try { s = localStorage.getItem(STORE_KEY); } catch (e) {}
    if (s) return done(s);
    try {   // в Telegram — ещё и облачное хранилище (переживает смену устройства/кэша)
      if (inTelegram && tg.CloudStorage && tg.isVersionAtLeast("6.9")) {
        return tg.CloudStorage.getItem(STORE_KEY, (err, v) => done(err ? null : v));
      }
    } catch (e) {}
    done(null);
  }
};

const calcCard = document.getElementById("calc-card");
const calcBody = document.getElementById("calc-body");
const calcBar  = document.getElementById("calc-bar");
const calcStepN = document.getElementById("calc-step-n");
const calcBack = document.getElementById("calc-back");
const calcPrice = document.getElementById("calc-price");
const priceLive = document.getElementById("price-live");
let advancing = false;

function branchSteps() { return calc.branch ? CALC[calc.branch].steps : []; }
function isResult()   { return calc.branch && calc.step > branchSteps().length; }

/* keepInView: после смены шага карточка калькулятора должна быть на экране
   (на главной она в середине длинной страницы — не даём шагу «уехать» за край) */
function renderCalc(keepInView) {
  const steps = branchSteps();
  const total = steps.length + 1;                    // +1 = выбор направления
  const pos = Math.min(calc.step, total);
  calcBar.style.width = (calc.branch ? (pos / total) * 100 : 4) + "%";
  calcStepN.textContent = isResult() ? "Готово" : calc.branch ? `Вопрос ${calc.step + 1} из ${total}` : "Вопрос 1";
  calcBack.hidden = calc.step === 0;

  if (calc.step === 0) renderBranchChoice();
  else if (isResult()) renderResult();
  else renderStep(steps[calc.step - 1]);

  // Цена «предварительно» — во время вопросов; на итоге цена крупно в самом экране
  const showPrice = calc.branch && !isResult() && calc.step > 0;
  calcPrice.hidden = !showPrice;
  if (showPrice) animatePrice(minPrice(calc.branch, calc.answers));

  calcBody.classList.remove("step-in"); void calcBody.offsetWidth; calcBody.classList.add("step-in");
  if (keepInView) {
    const top = calcCard.getBoundingClientRect().top;
    if (top < 110 || top > scroller.clientHeight * 0.45) scrollToEl(calcCard);
  }
  store.save();
}

function renderBranchChoice() {
  calcBody.innerHTML = `
    <h3 class="calc-q">Что снимаем?</h3>
    <div class="calc-branches">
      ${BRANCHES.map(id => `
        <button class="branch-card" data-branch="${id}">
          <span class="branch-ico">${CALC[id].icon}</span>
          <span class="branch-title">${escapeHtml(CALC[id].title)}</span>
          <span class="branch-from">от ${rub(minPrice(id, {}))} ${demoTag}</span>
        </button>`).join("")}
    </div>`;
  calcBody.querySelectorAll("[data-branch]").forEach(b => b.addEventListener("click", () => {
    hapticSelect();
    if (calc.branch !== b.dataset.branch) calc.answers = {};
    calc.branch = b.dataset.branch;
    calc.step = 1;
    renderCalc(true);
  }));
}

function renderStep(st) {
  const a = calc.answers[st.key];
  const isMulti = st.kind === "multi";
  const chosen = i => isMulti ? (a || []).includes(i) : a === i;
  calcBody.innerHTML = `
    <h3 class="calc-q">${escapeHtml(st.q)}</h3>
    ${st.hint ? `<p class="calc-hint">${escapeHtml(st.hint)}</p>` : ""}
    <div class="options${isMulti ? " multi" : ""}">
      ${st.options.map((o, i) => `
        <button class="option${chosen(i) ? " selected" : ""}" data-i="${i}">
          <span class="option-mark"></span>
          <span class="option-label">${escapeHtml(o.label)}</span>
          ${o.badge ? `<span class="option-badge">${escapeHtml(o.badge)}</span>` : ""}
        </button>`).join("")}
    </div>
    ${isMulti ? `<button class="primary-btn wide" id="calc-next">${(a || []).length ? "Далее" : "Пропустить"}</button>` : ""}`;

  calcBody.querySelectorAll(".option").forEach(btn => btn.addEventListener("click", () => {
    hapticSelect();
    const i = Number(btn.dataset.i);
    if (isMulti) {
      const set = new Set(calc.answers[st.key] || []);
      set.has(i) ? set.delete(i) : set.add(i);
      calc.answers[st.key] = [...set].sort();
      btn.classList.toggle("selected");
      document.getElementById("calc-next").textContent = set.size ? "Далее" : "Пропустить";
      animatePrice(minPrice(calc.branch, calc.answers));
      store.save();
    } else {
      if (advancing) return;                         // двойной тап не должен проскочить шаг
      advancing = true;
      calc.answers[st.key] = i;
      calcBody.querySelectorAll(".option").forEach(o => o.classList.toggle("selected", o === btn));
      animatePrice(minPrice(calc.branch, calc.answers));
      setTimeout(() => { advancing = false; calc.step++; renderCalc(true); }, 220);   // короткая пауза — видно, что выбор принят
    }
  }));
  const next = document.getElementById("calc-next");
  if (next) next.addEventListener("click", () => { haptic(); calc.step++; renderCalc(true); });
}

function briefText() {
  const br = CALC[calc.branch];
  const lines = [
    "Здравствуйте! Хочу обсудить проект. Бриф из мини-аппа QM:",
    "",
    `${br.icon} ${br.title}`,
    ...answerLines(calc.branch, calc.answers).map(l => "• " + l),
    "",
    `Предварительно в аппе: от ${rub(minPrice(calc.branch, calc.answers))}`
  ];
  if (calc.comment.trim()) lines.push(`Комментарий: ${calc.comment.trim()}`);
  lines.push("", `#бриф_${calc.branch === "event" ? "мероприятие" : "подкаст"}`);
  return lines.join("\n");
}

function renderResult() {
  const br = CALC[calc.branch];
  const price = minPrice(calc.branch, calc.answers);
  calcBody.innerHTML = `
    <div class="result-card">
      <div class="result-label">${br.icon} ${escapeHtml(br.title)} · предварительно</div>
      <div class="result-price">от ${rub(price)} ${demoTag}</div>
      <p class="result-note">${escapeHtml(CALC.note)}</p>
    </div>

    <div class="result-block">
      <div class="case-label">Ваш выбор</div>
      <ul class="result-list">${answerLines(calc.branch, calc.answers).map(l => `<li>${escapeHtml(l)}</li>`).join("")}</ul>
    </div>
    <div class="result-block">
      <div class="case-label">Всегда входит</div>
      <ul class="result-list check">${br.always.map(l => `<li>${escapeHtml(l)}</li>`).join("")}</ul>
    </div>

    <label class="result-block comment">
      <span class="case-label">Пара слов о проекте (необязательно)</span>
      <textarea id="calc-comment" rows="3" maxlength="300" placeholder="Например: подкаст для HR-бренда, старт в декабре">${escapeHtml(calc.comment)}</textarea>
    </label>

    <details class="brief-preview">
      <summary>Как бриф будет выглядеть в чате</summary>
      <pre id="brief-pre"></pre>
    </details>

    <button class="primary-btn wide" id="calc-send">Отправить бриф менеджеру</button>
    <div class="result-actions">
      <button class="ghost-btn" id="calc-restart">Пересчитать</button>
      <button class="ghost-btn" id="calc-copy">Скопировать</button>
    </div>`;
  const pre = document.getElementById("brief-pre");
  pre.textContent = briefText();
  const ta = document.getElementById("calc-comment");
  ta.addEventListener("input", () => { calc.comment = ta.value; pre.textContent = briefText(); store.save(); });
  document.getElementById("calc-send").addEventListener("click", () => sendToManager(briefText()));
  document.getElementById("calc-restart").addEventListener("click", () => {
    haptic(); calc = { branch: null, step: 0, answers: {}, comment: "" }; renderCalc(true);
  });
  document.getElementById("calc-copy").addEventListener("click", () => {
    haptic(); copyText(briefText()).then(ok => toast(ok ? "Бриф скопирован" : "Не удалось скопировать"));
  });
}

calcBack.addEventListener("click", () => {
  haptic();
  if (calc.step > 0) { calc.step--; renderCalc(true); }
});

/* Плавная смена цены (счётчик), чтобы было видно, как выбор влияет на итог */
let shownPrice = 0, priceAnim = null;
function animatePrice(target) {
  cancelAnimationFrame(priceAnim);
  const from = shownPrice, t0 = performance.now(), dur = 380;
  priceLive.classList.remove("bump"); void priceLive.offsetWidth; priceLive.classList.add("bump");
  (function tick(now) {
    const k = Math.min(1, (now - t0) / dur);
    shownPrice = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
    priceLive.innerHTML = `от ${rub(shownPrice)} ${demoTag}`;
    if (k < 1) priceAnim = requestAnimationFrame(tick);
  })(t0);
}

/* Перейти к калькулятору (с выбранной веткой / с готовыми ответами) */
function goToCalc(branchId, answers) {
  if (document.body.dataset.screen !== "home") showScreen("home");
  if (branchId && CALC[branchId]) {
    if (answers) calc = { branch: branchId, step: CALC[branchId].steps.length + 1, answers, comment: "" };
    else if (calc.branch !== branchId) calc = { branch: branchId, step: 1, answers: {}, comment: "" };
    else if (calc.step === 0) calc.step = 1;
  }
  renderCalc(false);
  setTimeout(() => scrollToEl(document.getElementById("calc-section")), 60);
}

/* =========================================================================
   ПРИМЕРНАЯ СТОИМОСТЬ ПРОЕКТОВ — типовые проекты, цена считается калькулятором
   ========================================================================= */
(function renderExamples() {
  const box = document.getElementById("examples");
  (STUDIO.examples || []).forEach(ex => {
    if (!CALC[ex.branch]) return;
    const answers = answersFromPick(ex.branch, ex.pick || {});
    const br = CALC[ex.branch];
    // В карточке — только состав проекта: без пустых строк и без «Сроков» (это не про состав)
    const deadline = br.steps.find(st => st.key === "deadline");
    const lines = answerLines(ex.branch, answers)
      .filter(l => !l.endsWith(": —") && !(deadline && l.startsWith((deadline.short || deadline.q) + ":")));
    const card = document.createElement("div");
    card.className = "example-card";
    card.innerHTML = `
      <div class="example-top">
        <span class="example-kind">${br.icon} ${escapeHtml(br.title)}</span>
        <span class="example-price">от ${rub(priceOf(ex.branch, answers))}</span>
      </div>
      <div class="example-title">${escapeHtml(ex.title)}</div>
      ${ex.text ? `<p class="example-text">${escapeHtml(ex.text)}</p>` : ""}
      <ul class="example-list">${lines.map(l => `<li>${escapeHtml(l)}</li>`).join("")}</ul>
      <button class="ghost-btn small">Посчитать похожий ›</button>`;
    card.querySelector("button").addEventListener("click", () => { haptic(); goToCalc(ex.branch, answers); });
    box.appendChild(card);
  });
})();

/* =========================================================================
   СВЯЗЬ: контакты + частые вопросы
   ========================================================================= */
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
  btn.href = managerUrl();
  btn.innerHTML = `
    <span class="contact-ico">✈️</span>
    <span class="contact-main">
      <span class="contact-label">Написать в Telegram</span>
      <span class="contact-value">@${escapeHtml(STUDIO.managerUsername)}</span>
    </span>
    <span class="contact-arrow">›</span>`;
  btn.addEventListener("click", (e) => {
    haptic();
    if (inTelegram && tg.openTelegramLink) { e.preventDefault(); tg.openTelegramLink(btn.href); }
  });
  contacts.appendChild(btn);
}

/* Частые вопросы: раскрывашки, под каждым ответом — «Спросить подробнее» */
const faqEl = document.getElementById("faq");
STUDIO.faq.forEach(item => {
  const d = document.createElement("details");
  d.className = "faq-item";
  d.innerHTML = `
    <summary>${escapeHtml(item.q)}</summary>
    <p>${escapeHtml(item.a)}</p>
    <button class="link-btn small">Спросить подробнее ›</button>`;
  d.addEventListener("toggle", () => { if (d.open) hapticSelect(); });
  d.querySelector("button").addEventListener("click", () =>
    sendToManager(`Здравствуйте! Вопрос из мини-аппа QM — «${item.q}»: `));
  faqEl.appendChild(d);
});
document.getElementById("ask-own").addEventListener("click", () =>
  sendToManager("Здравствуйте! Вопрос из мини-аппа QM: "));

/* =========================================================================
   ПЕРЕКЛЮЧЕНИЕ РАЗДЕЛОВ (2 вкладки) + кнопки-переходы внутри экранов
   ========================================================================= */
const screens = { home: "screen-home", contacts: "screen-contacts" };
function showScreen(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.screen === name));
  Object.entries(screens).forEach(([k, id]) => document.getElementById(id).classList.toggle("hidden", k !== name));
  document.body.dataset.screen = name;   // фон главного экрана виден только на «Главной»
  scroller.scrollTo(0, 0);
  heroUpdate();                 // пересинхронизировать 3D-фон (актуально при возврате на «Главную»)
  if (name === "contacts") setCta(STUDIO.orderButtonText, () => sendToManager("Здравствуйте! Хочу обсудить проект (пишу из мини-аппа QM).\n\n#связь"));
  else hideCta();
}
document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => { haptic(); showScreen(tab.dataset.screen); }));
document.addEventListener("click", e => {
  const go = e.target.closest("[data-go]");
  if (go) { haptic(); showScreen(go.dataset.go); }
});

/* =========================================================================
   ГЛУБОКИЕ ССЫЛКИ: t.me/<бот>/<апп>?startapp=calc_podcast — сразу нужное место.
   Работают после регистрации аппа через /newapp в @BotFather.
   В браузере для проверки: index.html?startapp=calc_event
     calc / calc_podcast / calc_event — к калькулятору (с веткой)
     cases — к кейсам · prices — к примерной стоимости · contacts — «Связь»
   ========================================================================= */
function startParam() {
  const fromTg = tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param;
  return fromTg || new URLSearchParams(location.search).get("startapp") || "";
}

store.load(saved => {
  if (saved) {
    try {
      const s = JSON.parse(saved);
      if (s && (s.branch === null || CALC[s.branch])) calc = { branch: s.branch, step: s.step || 0, answers: s.answers || {}, comment: s.comment || "" };
    } catch (e) {}
  }
  renderCalc(false);

  const sp = startParam();
  const later = fn => setTimeout(fn, 400);           // дать странице разложиться
  if (sp === "calc") later(() => goToCalc());
  else if (sp.startsWith("calc_")) later(() => goToCalc(sp.slice(5)));
  else if (sp === "cases") later(() => scrollToEl(document.getElementById("cases-title")));
  else if (sp === "prices") later(() => scrollToEl(document.getElementById("examples-section")));
  else if (sp === "contacts") showScreen("contacts");
});

/* Утилита: экранируем текст, чтобы не сломать вёрстку и не было XSS */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
