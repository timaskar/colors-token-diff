const DATA = window.TOKEN_DIFF_DATA;

const state = {
  view: new URLSearchParams(window.location.search).get("view") || "primitiveMigration",
  query: "",
};

const FEEDBACK_REPO = "https://github.com/timaskar/colors-token-diff/issues/new";

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function alphaPercent(alpha) {
  return `${Math.round((typeof alpha === "number" ? alpha : 1) * 100)}%`;
}

function valueLabel(item) {
  if (!item) return "";
  return item.alpha === 1 ? item.hex : `${item.hex} / ${alphaPercent(item.alpha)}`;
}

function primitiveReasonLabel(reason) {
  const labels = {
    "same Hex + alpha": "то же значение",
    "used by matched semantic token": "используется новым semantic-токеном",
    "desktop variant collapsed into base token": "@desktop схлопнули в базовый токен",
  };
  return labels[reason] || reason || "";
}

function textOfToken(token) {
  if (!token) return "";
  return [
    token.library,
    token.mode,
    token.path,
    token.hex,
    token.valueLabel,
    token.cssVar,
    token.codeSyntaxWeb,
    token.aliasName,
    token.primitivePath,
  ].join(" ").toLowerCase();
}

function matchesText(text) {
  return !state.query || text.toLowerCase().includes(state.query.toLowerCase());
}

function swatch(tokenOrColor) {
  const hex = tokenOrColor?.hex || "#000000";
  const alpha = typeof tokenOrColor?.alpha === "number" ? tokenOrColor.alpha : 1;
  return `<span class="swatch" title="${escapeHtml(valueLabel({ hex, alpha }))}"><span class="swatch-fill" style="background:${escapeHtml(hex)};opacity:${alpha}"></span></span>`;
}

function groupBy(list, getter) {
  const map = new Map();
  for (const item of list) {
    const key = getter(item) || "Other";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function semanticRows() {
  const rows = new Map();
  for (const token of DATA.tokens.semantic) {
    const key = token.path;
    if (!rows.has(key)) rows.set(key, { path: key, group: token.group, light: null, dark: null });
    rows.get(key)[token.mode.toLowerCase()] = token;
  }
  return [...rows.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function primitiveUsageMap() {
  const map = new Map();
  for (const token of DATA.tokens.semantic) {
    const key = token.primitivePath || token.aliasName;
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(token);
  }
  return map;
}

const usageByPrimitive = primitiveUsageMap();

function primitiveUsageText(primitivePath) {
  return (usageByPrimitive.get(primitivePath) || []).map(textOfToken).join(" ");
}

function primitiveValuePill(token, extra = "") {
  if (!token) return `<span class="empty-value">—</span>`;
  return `
    <span class="value-pill">
      ${swatch(token)}
      <span>${escapeHtml(token.aliasName || token.path)}</span>
      ${extra ? `<em>${escapeHtml(extra)}</em>` : ""}
    </span>
  `;
}

function section(title, body, count = "") {
  return `
    <section class="figma-section">
      <div class="section-title">
        <h3>${escapeHtml(title)}</h3>
        ${count ? `<span>${escapeHtml(count)}</span>` : ""}
      </div>
      ${body}
    </section>
  `;
}

function renderPrimitiveMigration() {
  const items = DATA.primitiveMigration.all.filter((item) => {
    const text = [
      item.status,
      item.valueLabel,
      item.hex,
      ...(item.oldTokens || []).map(textOfToken),
      ...(item.targets || []).map((target) => `${target.primitive.path} ${target.primitive.valueLabel} ${target.reason}`),
      item.nearestPrimitive ? `${item.nearestPrimitive.path} ${item.nearestPrimitive.valueLabel}` : "",
    ].join(" ");
    return matchesText(text);
  });

  const groups = [
    ["kept", "Стали primitives 1:1", "без изменения значения"],
    ["merged", "Заменили на другой primitive", "старый Hex/alpha схлопнули"],
    ["discarded", "Откинули", "нет явной primitive-пары"],
  ];

  return groups.map(([status, title, note]) => {
    const groupItems = items.filter((item) => item.status === status);
    const rows = groupItems.map((item) => {
      const target = item.targets[0]?.primitive;
      const reason = item.targets[0] ? primitiveReasonLabel(item.targets[0].reason) : "значение откинули";
      return `
        <tr>
          <td>
            <div class="name-cell">
              ${swatch(item)}
              <div>
                <strong>${escapeHtml(item.valueLabel)}</strong>
                <span>${item.oldTokens.length} стар. токен${item.oldTokens.length === 1 ? "" : "ов"}</span>
              </div>
            </div>
          </td>
          <td>${item.oldTokens.slice(0, 3).map((token) => `<span class="path-line">${escapeHtml(token.mode)} · ${escapeHtml(token.path)}</span>`).join("")}</td>
          <td>
            ${target ? primitiveValuePill(target) : `<strong>Не вошло</strong><span class="path-line">Ближайший: ${escapeHtml(item.nearestPrimitive?.path || "—")}</span>`}
          </td>
          <td><span class="subtle">${escapeHtml(reason)}</span></td>
        </tr>
      `;
    }).join("");
    return section(title, table(["Было", "Где было", "Стало", "Что произошло"], rows), `${groupItems.length} · ${note}`);
  }).join("");
}

function renderPrimitives() {
  const primitives = DATA.tokens.primitive.filter((token) => matchesText(`${textOfToken(token)} ${primitiveUsageText(token.path)}`));
  const groups = groupBy(primitives, (token) => token.group);
  return [...groups.entries()].map(([group, tokens]) => {
    const rows = tokens.map((token) => {
      const usages = usageByPrimitive.get(token.path) || [];
      const unused = usages.length === 0;
      return `
        <tr class="${unused ? "unused-row" : ""}">
          <td>
            <div class="name-cell">
              <span class="token-icon">◌</span>
              <strong>${escapeHtml(token.name)}</strong>
            </div>
          </td>
          <td>${primitiveValuePill(token, token.alpha !== 1 ? alphaPercent(token.alpha) : "")}</td>
          <td>
            ${unused
              ? `<span class="unused-badge">Не используется в Semantic</span><span class="path-line">Кандидат на ревизию палитры</span>`
              : `<strong>${usages.length}</strong>${usages.slice(0, 4).map((item) => `<span class="path-line">${escapeHtml(item.mode)} · ${escapeHtml(item.path)}</span>`).join("")}${usages.length > 4 ? `<span class="path-line">+${usages.length - 4} еще</span>` : ""}`}
          </td>
        </tr>
      `;
    }).join("");
    return section(group, table(["Name", "Value", "Used in Semantic"], rows), `${tokens.length}`);
  }).join("");
}

function renderSemantic() {
  const rows = semanticRows().filter((row) => matchesText(`${row.path} ${textOfToken(row.light)} ${textOfToken(row.dark)}`));
  const groups = groupBy(rows, (row) => row.group);
  return [...groups.entries()].map(([group, groupRows]) => {
    const body = groupRows.map((row) => {
      const name = row.path.split("/").slice(1).join("/");
      return `
        <tr>
          <td>
            <div class="name-cell">
              <span class="token-icon">◌</span>
              <strong>${escapeHtml(name)}</strong>
            </div>
          </td>
          <td>${primitiveValuePill(row.light)}</td>
          <td>${primitiveValuePill(row.dark)}</td>
        </tr>
      `;
    }).join("");
    return section(group, table(["Name", "Light", "Dark"], body), `${groupRows.length}`);
  }).join("");
}

function renderFolders() {
  const primitiveGroups = [...groupBy(DATA.tokens.primitive, (token) => token.group).entries()];
  const semanticGroups = [...groupBy(semanticRows(), (row) => row.group).entries()];
  return `
    <div class="folder-grid">
      ${collectionCard("Colors / Primitives", DATA.tokens.primitive.length, primitiveGroups)}
      ${collectionCard("Colors / Semantic", semanticRows().length, semanticGroups)}
    </div>
  `;
}

function collectionCard(title, count, groups) {
  return `
    <section class="collection-card">
      <div class="collection-head">
        <strong>${escapeHtml(title)}</strong>
        <span>${count}</span>
      </div>
      <div class="folder-list">
        ${groups.map(([name, items]) => `
          <div class="folder-row">
            <span>${escapeHtml(name)}</span>
            <strong>${items.length}</strong>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderDisappeared() {
  const discarded = DATA.primitiveMigration.discarded.filter((item) => matchesText(`${item.valueLabel} ${item.oldTokens.map(textOfToken).join(" ")}`));
  const removed = DATA.comparison.removed.filter((token) => matchesText(textOfToken(token)));
  return `
    ${section("Откинутые Hex + alpha", table(["Значение", "Где было", "Ближайший primitive"], discarded.map((item) => `
      <tr>
        <td>${primitiveValuePill(item)}</td>
        <td>${item.oldTokens.map((token) => `<span class="path-line">${escapeHtml(token.mode)} · ${escapeHtml(token.path)}</span>`).join("")}</td>
        <td>${escapeHtml(item.nearestPrimitive?.path || "—")}</td>
      </tr>
    `).join("")), `${discarded.length}`)}
    ${section("Semantic без новой пары", table(["Токен", "Значение", "CSS"], removed.map((token) => `
      <tr>
        <td><strong>${escapeHtml(token.mode)} · ${escapeHtml(token.path)}</strong></td>
        <td>${primitiveValuePill(token)}</td>
        <td>${escapeHtml(token.cssVar || "—")}</td>
      </tr>
    `).join("")), `${removed.length}`)}
  `;
}

function auditItems() {
  const c = DATA.summary.counts;
  return [
    ["Подтверждено", "Двухуровневая система", `Все ${DATA.tokens.semantic.length} semantic-токенов ссылаются на primitives.`],
    ["Уточнить", "Количество primitives", `В твоей документации было “всего: 61 primitive-токен”; в экспортированном файле сейчас ${c.primitiveTokens}.`],
    ["Уточнить", "Как считать старые цвета", "Если считать только Hex без alpha, их 39. Если считать Hex + alpha как отдельные значения, их 68."],
    ["Подтверждено", "@desktop убраны", "В старой Colors было 10 @desktop-токенов, в новой Semantic их 0."],
    ["Уточнить", "Схлопнутые цвета не всегда почти одинаковые", "В документации был критерий “разница меньше 5 RGB”. Но #111112 → #000000 отличается сильнее, и #FBFBFB → #F2F2F2 тоже. Это может быть ок, просто это уже не строго “почти тот же цвет”."],
    ["Подтверждено", "Accent переехали в Status", "Yellow/Red/Green/Blue теперь Warning/Error/Success/Info."],
    ["Проверить", "Black/75 отсутствует", "В primitives есть White/75, но нет Black/75. Старое #000000 / 75% не вошло в базовую палитру."],
  ];
}

function renderAudit() {
  const rows = auditItems().filter((item) => matchesText(item.join(" "))).map(([status, title, text]) => `
    <tr>
      <td><span class="audit-status ${status === "Подтверждено" ? "ok" : ""}">${escapeHtml(status)}</span></td>
      <td><strong>${escapeHtml(title)}</strong></td>
      <td>${escapeHtml(text)}</td>
    </tr>
  `).join("");
  return section("Проверка документации", table(["Статус", "Тезис", "Сверка"], rows), `${auditItems().length}`);
}

function table(headers, rows) {
  return `
    <div class="variable-table-wrap">
      <table class="variable-table">
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>${rows || `<tr><td colspan="${headers.length}">Ничего не найдено</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

const views = [
  { id: "primitiveMigration", title: "Hex → Primitives", count: () => DATA.primitiveMigration.all.length, render: renderPrimitiveMigration },
  { id: "primitives", title: "Primitives", count: () => DATA.tokens.primitive.length, render: renderPrimitives },
  { id: "semantic", title: "Semantic", count: () => semanticRows().length, render: renderSemantic },
  { id: "folders", title: "Папки", count: () => 2, render: renderFolders },
  { id: "disappeared", title: "Исчезло", count: () => DATA.primitiveMigration.discarded.length + DATA.comparison.removed.length, render: renderDisappeared },
  { id: "audit", title: "Проверка", count: () => auditItems().length, render: renderAudit },
];

function currentView() {
  return views.find((view) => view.id === state.view) || views[0];
}

function renderTabs() {
  $("#tabs").innerHTML = views.map((view) => `
    <button class="tab ${currentView().id === view.id ? "active" : ""}" data-view="${view.id}">
      <span>${escapeHtml(view.title)}</span>
      <span class="tab-count">${view.count()}</span>
    </button>
  `).join("");
}

function renderContent() {
  const view = currentView();
  $("#viewTitle").textContent = view.title;
  $("#viewDescription").textContent = view.id === "semantic"
    ? "Текущая semantic-коллекция: Light и Dark значения как ссылки на primitives."
    : view.id === "primitives"
      ? "Базовая палитра и все semantic-токены, которые используют каждый primitive."
      : view.id === "primitiveMigration"
        ? "Какие старые Hex + alpha стали primitives, какие схлопнули, какие откинули."
        : "";
  $("#resultCount").textContent = `${view.count()} шт.`;
  $("#content").innerHTML = view.render();
  updateFeedbackLink();
}

function render() {
  renderTabs();
  renderContent();
}

function updateFeedbackLink() {
  const link = $("#feedbackLink");
  if (!link) return;
  const view = currentView();
  const pageUrl = new URL(window.location.href);
  const params = new URLSearchParams({
    labels: "design-feedback",
    title: `[feedback] ${view.title}`,
    body: [
      "## Комментарий",
      "",
      "<!-- Напишите, что смущает, что непонятно или что стоит проверить. -->",
      "",
      "## Контекст",
      `- Раздел: ${view.title}`,
      `- URL: ${pageUrl.toString()}`,
      state.query ? `- Поиск: ${state.query}` : "",
      "",
      "## Что ожидалось",
      "",
      "## Что исправить / проверить",
      "",
    ].filter(Boolean).join("\n"),
  });
  link.href = `${FEEDBACK_REPO}?${params.toString()}`;
}

$("#search").addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  renderContent();
});

$("#tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (!button) return;
  state.view = button.dataset.view;
  const url = new URL(window.location.href);
  url.searchParams.set("view", state.view);
  window.history.replaceState(null, "", url);
  render();
});

$("#copySummary").addEventListener("click", async () => {
  const c = DATA.summary.counts;
  await navigator.clipboard?.writeText([
    `Old Hex+alpha: ${c.oldColorValues}`,
    `Primitive exact: ${c.primitiveKeptValues}`,
    `Primitive merged: ${c.primitiveMergedValues}`,
    `Primitive discarded: ${c.primitiveDiscardedValues}`,
    `Primitives: ${c.primitiveTokens}`,
    `Semantic rows: ${semanticRows().length}`,
  ].join("\n"));
});

render();
