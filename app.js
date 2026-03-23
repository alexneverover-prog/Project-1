const STORAGE_KEYS = {
  language: "literaflow.language",
  sourceLanguage: "literaflow.sourceLanguage",
  history: "literaflow.history",
};

const PUBLIC_TRANSLATE_URL = "https://api.mymemory.translated.net/get";
const PAGE_PROXY_URL = "https://api.allorigins.win/raw?url=";

const DEMO_HTML = `
  <article>
    <h3>The House at the Edge of the Orchard</h3>
    <p><em>Alice</em> paused at the gate and listened. The wind moved through the branches as if the trees were exchanging a secret they did not mean to share with her.</p>
    <p>"You don't have to come with me," she said, though her hand had already found <strong>Daniel's</strong> sleeve.</p>
    <p>He smiled in that patient, maddening way of his. "And let you walk in there alone? I don't think so."</p>
    <blockquote>The old house stood beyond the orchard like a memory that had decided, at last, to take shape.</blockquote>
    <p>Alice looked up at the dark windows. She told herself she was not afraid. What unsettled her was the feeling that the house already knew her name.</p>
  </article>
`;

const NAME_GENDER_HINTS = {
  Alice: "женский",
  Emma: "женский",
  Olivia: "женский",
  Sophia: "женский",
  Isabella: "женский",
  Mia: "женский",
  Chloe: "женский",
  Lily: "женский",
  Daniel: "мужской",
  James: "мужской",
  Henry: "мужской",
  Thomas: "мужской",
  Noah: "мужской",
  Liam: "мужской",
  Ethan: "мужской",
  Oliver: "мужской",
};

const elements = {
  urlInput: document.getElementById("urlInput"),
  languageSelect: document.getElementById("languageSelect"),
  sourceLanguageSelect: document.getElementById("sourceLanguageSelect"),
  advancedPanel: document.getElementById("advancedPanel"),
  translateButton: document.getElementById("translateButton"),
  improveButton: document.getElementById("improveButton"),
  saveButton: document.getElementById("saveButton"),
  demoButton: document.getElementById("demoButton"),
  progressFill: document.getElementById("progressFill"),
  progressText: document.getElementById("progressText"),
  statusText: document.getElementById("statusText"),
  originalContent: document.getElementById("originalContent"),
  translationContent: document.getElementById("translationContent"),
  sourceMeta: document.getElementById("sourceMeta"),
  translationMeta: document.getElementById("translationMeta"),
  noticePanel: document.getElementById("noticePanel"),
  noticeTitle: document.getElementById("noticeTitle"),
  noticeText: document.getElementById("noticeText"),
  characterMemory: document.getElementById("characterMemory"),
  memoryBadge: document.getElementById("memoryBadge"),
  historyList: document.getElementById("historyList"),
  historyItemTemplate: document.getElementById("historyItemTemplate"),
  tabOriginal: document.getElementById("tabOriginal"),
  tabTranslation: document.getElementById("tabTranslation"),
  originalColumn: document.getElementById("originalColumn"),
  translationColumn: document.getElementById("translationColumn"),
};

const state = {
  sourceUrl: "",
  sourceTitle: "",
  sourceBlocks: [],
  translatedBlocks: [],
  characterMemory: {},
  isBusy: false,
};

initialize();

function initialize() {
  hydrateSettings();
  wireEvents();
  renderHistory();
}

function hydrateSettings() {
  elements.languageSelect.value = localStorage.getItem(STORAGE_KEYS.language) || elements.languageSelect.value;
  elements.sourceLanguageSelect.value =
    localStorage.getItem(STORAGE_KEYS.sourceLanguage) || elements.sourceLanguageSelect.value;
}

function wireEvents() {
  elements.languageSelect.addEventListener("change", persistSettings);
  elements.sourceLanguageSelect.addEventListener("change", persistSettings);
  elements.urlInput.addEventListener("keydown", handleUrlKeydown);

  elements.translateButton.addEventListener("click", handleTranslate);
  elements.improveButton.addEventListener("click", handleImproveStyle);
  elements.saveButton.addEventListener("click", handleSaveTranslation);
  elements.demoButton.addEventListener("click", loadDemoSource);

  elements.tabOriginal.addEventListener("click", () => switchTab("original"));
  elements.tabTranslation.addEventListener("click", () => switchTab("translation"));
}

function persistSettings() {
  localStorage.setItem(STORAGE_KEYS.language, elements.languageSelect.value);
  localStorage.setItem(STORAGE_KEYS.sourceLanguage, elements.sourceLanguageSelect.value);
}

function switchTab(tab) {
  const isOriginal = tab === "original";
  elements.tabOriginal.classList.toggle("is-active", isOriginal);
  elements.tabTranslation.classList.toggle("is-active", !isOriginal);
  elements.originalColumn.classList.toggle("is-active", isOriginal);
  elements.translationColumn.classList.toggle("is-active", !isOriginal);
}

async function handleTranslate() {
  if (state.isBusy) {
    return;
  }

  hideNotice();

  const url = elements.urlInput.value.trim();
  if (!url) {
    updateStatus("Добавьте ссылку на страницу", 0);
    showNotice("Ссылка не добавлена", "Вставьте URL страницы в первое поле, затем нажмите «Перевести».");
    elements.urlInput.focus();
    return;
  }

  try {
    state.isBusy = true;
    toggleControls();
    resetTranslation();
    updateStatus("Загружаю страницу и извлекаю основной текст", 10);

    const { title, blocks, source } = await fetchAndExtractSource(url);
    state.sourceUrl = url;
    state.sourceTitle = title;
    state.sourceBlocks = blocks;
    state.characterMemory = buildCharacterMemory(blocks);
    renderSource(blocks, title, source);
    renderCharacterMemory();

    updateStatus("Перевожу чанками с учетом контекста", 32);
    const translatedBlocks = await translateBlockGroups({
      blocks,
      mode: "translate",
      baseProgress: 32,
      maxProgress: 94,
    });

    state.translatedBlocks = translatedBlocks;
    renderTranslation(translatedBlocks, `Переведено на ${elements.languageSelect.value}`);
    elements.improveButton.disabled = false;
    elements.saveButton.disabled = false;

    saveHistoryEntry();
    renderHistory();
    updateStatus("Перевод готов", 100);
    switchTab("translation");
  } catch (error) {
    console.error(error);
    updateStatus(error.message || "Не удалось выполнить перевод", 0);
  } finally {
    state.isBusy = false;
    toggleControls();
  }
}

async function handleImproveStyle() {
  if (state.isBusy || !state.translatedBlocks.length) {
    return;
  }

  try {
    state.isBusy = true;
    toggleControls();
    updateStatus("Улучшаю стиль перевода без потери смысла", 18);

    const polished = await translateBlockGroups({
      blocks: state.translatedBlocks,
      mode: "polish",
      baseProgress: 18,
      maxProgress: 96,
    });

    state.translatedBlocks = polished;
    renderTranslation(polished, "Стиль дополнительно улучшен");
    saveHistoryEntry();
    renderHistory();
    updateStatus("Литературная правка завершена", 100);
  } catch (error) {
    console.error(error);
    updateStatus(error.message || "Не удалось улучшить стиль", 0);
  } finally {
    state.isBusy = false;
    toggleControls();
  }
}

function handleSaveTranslation() {
  if (!state.translatedBlocks.length) {
    return;
  }

  const sourceLabel = state.sourceTitle || "translation";
  const html = buildExportHtml(sourceLabel, state.sourceUrl, state.translatedBlocks);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(sourceLabel)}-translation.html`;
  link.click();
  URL.revokeObjectURL(url);
}

function loadDemoSource() {
  hideNotice();
  elements.urlInput.value = "https://example.com/demo-story";
  elements.sourceMeta.textContent = "Демо-источник";
  const { title, blocks } = extractStructuredContent(DEMO_HTML);
  state.sourceUrl = elements.urlInput.value;
  state.sourceTitle = title;
  state.sourceBlocks = blocks;
  state.characterMemory = buildCharacterMemory(blocks);
  state.translatedBlocks = [];
  renderSource(blocks, title, "Демо");
  renderCharacterMemory();
  renderTranslation([], "Перевод пока не выполнен");
  updateStatus("Демо-текст загружен. Нажмите «Перевести» для проверки без ручного ключа.", 0);
}

function handleUrlKeydown(event) {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  handleTranslate();
}

function toggleControls() {
  const disabled = state.isBusy;
  elements.translateButton.disabled = disabled;
  elements.demoButton.disabled = disabled;
  elements.improveButton.disabled = disabled || !state.translatedBlocks.length;
  elements.saveButton.disabled = disabled || !state.translatedBlocks.length;
}

function resetTranslation() {
  state.translatedBlocks = [];
  renderTranslation([], "Перевод пока не выполнен");
  elements.improveButton.disabled = true;
  elements.saveButton.disabled = true;
}

function updateStatus(text, progress) {
  elements.statusText.textContent = text;
  elements.progressText.textContent = `${Math.round(progress)}%`;
  elements.progressFill.style.width = `${Math.max(0, Math.min(progress, 100))}%`;
}

function showNotice(title, text) {
  elements.noticeTitle.textContent = title;
  elements.noticeText.textContent = text;
  elements.noticePanel.hidden = false;
}

function hideNotice() {
  elements.noticePanel.hidden = true;
}

async function fetchAndExtractSource(url) {
  try {
    const html = await fetchReadableHtml(url);
    const { title, blocks } = extractStructuredContent(html);
    if (!blocks.length) {
      throw new Error("Основной текст на странице не найден");
    }
    return { title, blocks, source: "Страница загружена" };
  } catch (error) {
    console.warn("Direct fetch failed, using demo fallback.", error);
    const { title, blocks } = extractStructuredContent(DEMO_HTML);
    return {
      title,
      blocks,
      source: "Демо fallback. Источник не открылся из браузера.",
    };
  }
}

async function fetchReadableHtml(url) {
  const attempts = [
    { href: url, source: "direct" },
    { href: `${PAGE_PROXY_URL}${encodeURIComponent(url)}`, source: "proxy" },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.href);
      if (!response.ok) {
        throw new Error(`Страница ответила статусом ${response.status}`);
      }

      const html = await response.text();
      if (!normalizeWhitespace(html).length) {
        throw new Error("Пустой ответ");
      }

      return html;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Не удалось получить HTML страницы");
}

function extractStructuredContent(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const title =
    doc.querySelector("meta[property='og:title']")?.getAttribute("content") ||
    doc.querySelector("title")?.textContent?.trim() ||
    "Без названия";

  const candidates = Array.from(
    doc.querySelectorAll("article, main, [role='main'], .post-content, .entry-content, .article-content, .storytext")
  );

  const root = pickBestRoot(candidates.length ? candidates : [doc.body]);
  const blocks = collectBlocks(root).slice(0, 80);

  return { title, blocks };
}

function pickBestRoot(candidates) {
  return candidates
    .filter(Boolean)
    .sort((left, right) => getReadableScore(right) - getReadableScore(left))[0];
}

function getReadableScore(element) {
  const paragraphs = element.querySelectorAll("p").length;
  const textLength = normalizeWhitespace(element.textContent || "").length;
  return paragraphs * 120 + textLength;
}

function collectBlocks(root) {
  const nodes = Array.from(root.querySelectorAll("h1, h2, h3, p, blockquote, li"))
    .filter((node) => normalizeWhitespace(node.textContent || "").length > 28)
    .slice(0, 120);

  return nodes.map((node, index) => {
    const tagName = node.tagName.toLowerCase();
    return {
      id: `block-${index + 1}`,
      tag: tagName === "li" ? "p" : tagName,
      html: sanitizeInlineMarkup(node).trim(),
      text: normalizeWhitespace(node.textContent || ""),
    };
  });
}

function sanitizeInlineMarkup(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent || "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const tag = node.tagName.toLowerCase();
  const safeChildren = Array.from(node.childNodes).map(sanitizeInlineMarkup).join("");
  const safeTag = ["em", "i", "strong", "b", "br"].includes(tag) ? tag : null;

  if (!safeTag) {
    return safeChildren;
  }

  if (safeTag === "br") {
    return "<br />";
  }

  return `<${safeTag}>${safeChildren}</${safeTag}>`;
}

function buildCharacterMemory(blocks) {
  const memory = {};

  blocks.forEach((block) => {
    const matches = block.text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
    matches.forEach((name) => {
      if (!memory[name]) {
        memory[name] = {
          gender: NAME_GENDER_HINTS[name] || guessGenderFromContext(name, blocks),
          notes: new Set(),
        };
      }

      const notes = inferNotes(name, block.text);
      notes.forEach((note) => memory[name].notes.add(note));
    });
  });

  return Object.fromEntries(
    Object.entries(memory)
      .slice(0, 12)
      .map(([name, info]) => [
        name,
        {
          gender: info.gender,
          notes: Array.from(info.notes),
        },
      ])
  );
}

function guessGenderFromContext(name, blocks) {
  const joined = blocks.map((block) => block.text).join(" ");
  const pattern = new RegExp(`${name}[^.?!]{0,80}\\b(she|her|hers|he|him|his)\\b`, "i");
  const match = joined.match(pattern);
  if (!match) {
    return "неопределен";
  }

  return ["she", "her", "hers"].includes(match[1].toLowerCase()) ? "женский" : "мужской";
}

function inferNotes(name, text) {
  const notes = [];
  if (new RegExp(`${name}[^.?!]{0,50}"`, "i").test(text)) {
    notes.push("участвует в диалоге");
  }
  if (new RegExp(`${name}[^.?!]{0,50}\\b(smiled|laughed|whispered|said|asked)\\b`, "i").test(text)) {
    notes.push("эмоционально активный персонаж");
  }
  if (!notes.length) {
    notes.push("требует контекстного наблюдения");
  }
  return notes;
}

async function translateBlockGroups({ blocks, mode, baseProgress, maxProgress }) {
  const chunks = chunkBlocks(blocks, 3);
  const translated = [];
  let rollingContext = "";

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const completion = (index + 1) / chunks.length;
    const progress = baseProgress + (maxProgress - baseProgress) * completion * 0.9;
    updateStatus(
      mode === "translate"
        ? `Перевод фрагмента ${index + 1} из ${chunks.length}`
        : `Литературная правка фрагмента ${index + 1} из ${chunks.length}`,
      progress
    );

    const result = await requestTranslation({
      chunk,
      mode,
      rollingContext,
      targetLanguage: elements.languageSelect.value,
      sourceLanguage: elements.sourceLanguageSelect.value,
      characterMemory: state.characterMemory,
    });

    translated.push(...result);
    rollingContext = translated
      .slice(-2)
      .map((item) => stripHtml(item.html))
      .join("\n");
  }

  return translated;
}

async function requestTranslation({
  chunk,
  mode,
  targetLanguage,
  sourceLanguage,
}) {
  if (mode === "polish") {
    return chunk.map((block) => {
      const polishedHtml = polishTranslatedHtml(block.html, targetLanguage);
      return {
        ...block,
        html: polishedHtml,
        text: stripHtml(polishedHtml),
      };
    });
  }

  return Promise.all(
    chunk.map(async (block) => {
      const translatedHtml = await translateBlockHtml(block.html, {
        sourceLanguage,
        targetLanguage,
      });
      return {
        ...block,
        html: translatedHtml,
        text: stripHtml(translatedHtml),
      };
    })
  );
}

async function translateBlockHtml(html, { sourceLanguage, targetLanguage }) {
  const encoded = encodeInlineMarkup(html);
  const sourceCode = resolveSourceLanguageCode(sourceLanguage, stripHtml(html));
  const targetCode = resolveTargetLanguageCode(targetLanguage);
  const translated = await translatePublicText(encoded, sourceCode, targetCode);
  return decodeInlineMarkup(translated);
}

async function translatePublicText(text, sourceCode, targetCode) {
  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceCode}|${targetCode}`,
    de: "litera@flow.local",
  });

  const response = await fetch(`${PUBLIC_TRANSLATE_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Публичный переводчик временно недоступен: ${response.status}`);
  }

  const data = await response.json();
  const translatedText = decodeEntities(data.responseData?.translatedText || "");
  if (!translatedText) {
    throw new Error("Публичный переводчик вернул пустой ответ");
  }

  return translatedText;
}

function chunkBlocks(blocks, chunkSize) {
  const chunks = [];
  for (let index = 0; index < blocks.length; index += chunkSize) {
    chunks.push(blocks.slice(index, index + chunkSize));
  }
  return chunks;
}

function renderSource(blocks, title, sourceLabel) {
  elements.sourceMeta.textContent = `${title} · ${sourceLabel}`;
  elements.originalContent.innerHTML = blocks
    .map((block) => `<${block.tag}>${block.html}</${block.tag}>`)
    .join("");
}

function renderTranslation(blocks, meta) {
  elements.translationMeta.textContent = meta;

  if (!blocks.length) {
    elements.translationContent.innerHTML =
      "<p>Здесь появится литературный перевод с учетом контекста и структуры текста.</p>";
    return;
  }

  elements.translationContent.innerHTML = blocks
    .map((block) => `<${block.tag}>${block.html}</${block.tag}>`)
    .join("");
}

function resolveSourceLanguageCode(selected, text) {
  if (selected && selected !== "auto") {
    return selected;
  }

  if (/[а-яёіїє]/i.test(text)) {
    return "ru";
  }

  if (/[äöüß]/i.test(text)) {
    return "de";
  }

  if (/[àâçéèêëîïôûùüÿœ]/i.test(text)) {
    return "fr";
  }

  if (/[ñ¡¿]/i.test(text)) {
    return "es";
  }

  return "en";
}

function resolveTargetLanguageCode(language) {
  const map = {
    Русский: "ru",
    Украинский: "uk",
    Немецкий: "de",
    Французский: "fr",
  };

  return map[language] || "ru";
}

function encodeInlineMarkup(html) {
  return html
    .replace(/<strong>/gi, " __LF_STRONG_OPEN__ ")
    .replace(/<\/strong>/gi, " __LF_STRONG_CLOSE__ ")
    .replace(/<b>/gi, " __LF_STRONG_OPEN__ ")
    .replace(/<\/b>/gi, " __LF_STRONG_CLOSE__ ")
    .replace(/<em>/gi, " __LF_EM_OPEN__ ")
    .replace(/<\/em>/gi, " __LF_EM_CLOSE__ ")
    .replace(/<i>/gi, " __LF_EM_OPEN__ ")
    .replace(/<\/i>/gi, " __LF_EM_CLOSE__ ")
    .replace(/<br\s*\/?>/gi, " __LF_BR__ ");
}

function decodeInlineMarkup(text) {
  return text
    .replace(/__LF_STRONG_OPEN__/g, "<strong>")
    .replace(/__LF_STRONG_CLOSE__/g, "</strong>")
    .replace(/__LF_EM_OPEN__/g, "<em>")
    .replace(/__LF_EM_CLOSE__/g, "</em>")
    .replace(/__LF_BR__/g, "<br />")
    .replace(/\s+(<\/?(?:strong|em)>)/g, "$1")
    .replace(/(<br \/>)+\s*/g, "<br />");
}

function polishTranslatedHtml(html, targetLanguage) {
  if (resolveTargetLanguageCode(targetLanguage) !== "ru") {
    return html;
  }

  const container = document.createElement("div");
  container.innerHTML = html;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  textNodes.forEach((node) => {
    node.textContent = polishRussianText(node.textContent || "");
  });

  return container.innerHTML;
}

function polishRussianText(text) {
  return text
    .replace(/\s{2,}/g, " ")
    .replace(/(^|[\s(])-\s/g, "$1— ")
    .replace(/"\s*([^"]+?)\s*"/g, "«$1»")
    .replace(/\.{3}/g, "…")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

function renderCharacterMemory() {
  const entries = Object.entries(state.characterMemory);
  elements.memoryBadge.textContent = `${entries.length} записей`;

  if (!entries.length) {
    elements.characterMemory.className = "memory-list empty-state";
    elements.characterMemory.textContent =
      "После анализа здесь появятся имена, вероятный род и контекстные заметки.";
    return;
  }

  elements.characterMemory.className = "memory-list";
  elements.characterMemory.innerHTML = entries
    .map(
      ([name, info]) => `
        <article class="memory-entry">
          <strong>${escapeHtml(name)}</strong>
          <span>Род: ${escapeHtml(info.gender)}</span>
          <div>${escapeHtml(info.notes.join(", "))}</div>
        </article>
      `
    )
    .join("");
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || "[]");
  } catch {
    return [];
  }
}

function saveHistoryEntry() {
  const history = getHistory();
  const entry = {
    id: crypto.randomUUID(),
    title: state.sourceTitle || "Без названия",
    url: state.sourceUrl,
    translatedBlocks: state.translatedBlocks,
    sourceBlocks: state.sourceBlocks,
    savedAt: new Date().toISOString(),
    language: elements.languageSelect.value,
  };

  const nextHistory = [entry, ...history].slice(0, 8);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(nextHistory));
}

function renderHistory() {
  const history = getHistory();
  if (!history.length) {
    elements.historyList.innerHTML =
      '<article class="history-empty">История пока пуста. Первый перевод появится здесь автоматически.</article>';
    return;
  }

  elements.historyList.innerHTML = "";
  history.forEach((entry) => {
    const fragment = elements.historyItemTemplate.content.cloneNode(true);
    fragment.querySelector(".history-title").textContent = `${entry.title} · ${entry.language}`;
    fragment.querySelector(".history-url").textContent = entry.url;
    fragment.querySelector(".history-date").textContent = formatDate(entry.savedAt);
    fragment.querySelector(".history-open").addEventListener("click", () => openHistoryEntry(entry.id));
    elements.historyList.appendChild(fragment);
  });
}

function openHistoryEntry(entryId) {
  const entry = getHistory().find((item) => item.id === entryId);
  if (!entry) {
    return;
  }

  state.sourceUrl = entry.url;
  state.sourceTitle = entry.title;
  state.sourceBlocks = entry.sourceBlocks;
  state.translatedBlocks = entry.translatedBlocks;
  state.characterMemory = buildCharacterMemory(entry.sourceBlocks);

  elements.urlInput.value = entry.url;
  renderSource(entry.sourceBlocks, entry.title, "История");
  renderTranslation(entry.translatedBlocks, `Открыто из истории · ${entry.language}`);
  renderCharacterMemory();
  elements.improveButton.disabled = false;
  elements.saveButton.disabled = false;
  switchTab("translation");
}

function buildExportHtml(title, sourceUrl, blocks) {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — перевод</title>
  <style>
    body { margin: 0; padding: 40px 20px; font-family: Georgia, serif; line-height: 1.8; background: #f8f4ef; color: #2f241d; }
    main { max-width: 840px; margin: 0 auto; background: white; border-radius: 24px; padding: 40px; }
    h1 { margin-top: 0; line-height: 1.1; }
    .meta { color: #7b6c62; margin-bottom: 24px; font-family: Arial, sans-serif; }
    blockquote { margin-left: 0; padding-left: 18px; border-left: 3px solid #d8805f; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">${escapeHtml(sourceUrl)}</p>
    ${blocks.map((block) => `<${block.tag}>${block.html}</${block.tag}>`).join("\n")}
  </main>
</body>
</html>`;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return normalizeWhitespace(div.textContent || "");
}

function decodeEntities(text) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
