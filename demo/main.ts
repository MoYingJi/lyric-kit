import {
  applyLyricLanguages,
  detectFormat,
  extractLyricAuthors,
  normalizeLyricLines,
  parseASS,
  parseKRC,
  parseLRC,
  parseLyric,
  parseLyS,
  parseQRC,
  parseSRT,
  parseTTML,
  parseYRC,
  serializeLyric,
  stripLyricMetadata,
} from "../src";
import type { LyricFormat, LyricLine, LyricMetadata, LyricResult } from "../src/types";
import { buildStripOptions, createInitialState, type DemoState } from "./config";
import { escapeHtml } from "./util";
import "./style.css";

// ---- DOM 元素 ----
const tabsBar = document.getElementById("tabs") as HTMLElement;
const tabPanels = [...document.querySelectorAll<HTMLElement>(".tab-panel")];
const trackTabs = document.getElementById("track-tabs") as HTMLElement;
const trackPanels = [...document.querySelectorAll<HTMLElement>(".track-panel")];
const trackFormatLabel = document.getElementById("track-format-label") as HTMLSpanElement;
const trackFormatSelect = document.getElementById("track-format") as HTMLSelectElement;
const resultEl = document.getElementById("result") as HTMLDivElement;
const outputTitle = document.getElementById("output-title") as HTMLSpanElement;
const outputPre = document.getElementById("output-pre") as HTMLPreElement;
const btnCopy = document.getElementById("btn-copy") as HTMLButtonElement;

const mainInput = document.getElementById("main-input") as HTMLTextAreaElement;
const translationInput = document.getElementById("translation-input") as HTMLTextAreaElement;
const romajiInput = document.getElementById("romaji-input") as HTMLTextAreaElement;
const kanaInput = document.getElementById("kana-input") as HTMLTextAreaElement;
const trackFileInput = document.getElementById("track-file") as HTMLInputElement;
const trackFileBtn = document.getElementById("track-file-btn") as HTMLButtonElement;
const trackFileName = document.getElementById("track-file-name") as HTMLSpanElement;

/** 各轨道对应的输入框 */
const TRACK_INPUTS: Record<Track, HTMLTextAreaElement> = {
  main: mainInput,
  translation: translationInput,
  romaji: romajiInput,
  kana: kanaInput,
};

const statFormat = document.getElementById("stat-format") as HTMLSpanElement;
const statLines = document.getElementById("stat-lines") as HTMLSpanElement;
const statBg = document.getElementById("stat-bg") as HTMLSpanElement;
const statDuet = document.getElementById("stat-duet") as HTMLSpanElement;
const statDuration = document.getElementById("stat-duration") as HTMLSpanElement;
const statAuthors = document.getElementById("stat-authors") as HTMLSpanElement;

// ---- 状态 ----
const state: DemoState = createInitialState();

type Category = "parse" | "clean";
type Track = "main" | "translation" | "romaji" | "kana";
let activeCategory: Category = "parse";
let activeTrack: Track = "main";

/** 主歌词（含清洗流水线后）的解析缓存，供清洗分类复用 */
let cached: { format: LyricFormat; result: LyricResult; lines: LyricLine[] } | null = null;

const formatTime = (ms: number): string => {
  const safe = Math.max(0, ms);
  const sec = Math.floor(safe / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
};

const clearResult = (): void => {
  resultEl.replaceChildren();
};

const lineMainText = (line: LyricLine): string =>
  line.words
    .map((w) => w.word)
    .join("")
    .trim();

// ---- 结果渲染：歌词行 + 可展开的逐字详情 ----

const renderLines = (lines: LyricLine[], metadata: LyricMetadata): void => {
  statFormat.textContent = cached ? cached.format.toUpperCase() : "--";
  statLines.textContent = String(lines.length);
  statBg.textContent = String(lines.filter((l) => l.isBG).length);
  statDuet.textContent = String(lines.filter((l) => l.isDuet).length);
  statDuration.textContent = formatTime(lines.at(-1)?.endTime ?? 0);

  const fragment = document.createDocumentFragment();

  const metaCard = renderMetadata(metadata);
  if (metaCard) fragment.appendChild(metaCard);

  for (const line of lines) {
    const row = document.createElement("div");
    row.className = "lyric-line";
    if (line.isBG) row.classList.add("is-bg");
    if (line.isDuet) row.classList.add("is-duet");

    const main = document.createElement("div");
    main.className = "line-main";

    const timeEl = document.createElement("span");
    timeEl.className = "line-time";
    timeEl.textContent = `${formatTime(line.startTime)} - ${formatTime(line.endTime)}`;
    main.appendChild(timeEl);

    const bodyEl = document.createElement("div");
    bodyEl.className = "line-body";

    const textEl = document.createElement("div");
    textEl.className = "line-text";
    textEl.textContent = lineMainText(line) || "·";
    bodyEl.appendChild(textEl);

    if (line.words.some((w) => w.romanWord)) {
      const romanEl = document.createElement("div");
      romanEl.className = "line-sub line-roman";
      romanEl.textContent = line.words.map((w) => w.romanWord ?? w.word).join(" ");
      bodyEl.appendChild(romanEl);
    } else if (line.romanLyric) {
      const romanEl = document.createElement("div");
      romanEl.className = "line-sub line-roman";
      romanEl.textContent = line.romanLyric;
      bodyEl.appendChild(romanEl);
    }

    if (line.words.some((w) => w.ruby?.length)) {
      const rubyEl = document.createElement("div");
      rubyEl.className = "line-sub line-ruby";
      rubyEl.textContent = line.words.flatMap((w) => (w.ruby ?? []).map((r) => r.word)).join(" ");
      bodyEl.appendChild(rubyEl);
    }

    if (line.translatedLyric) {
      const transEl = document.createElement("div");
      transEl.className = "line-sub line-trans";
      transEl.textContent = line.translatedLyric;
      bodyEl.appendChild(transEl);
    }

    // 标签：每个独立徽章、分色、间隔
    const tagDefs: Array<[string, string]> = [];
    if (line.isBG) tagDefs.push(["背景人声", "bg"]);
    if (line.isDuet) tagDefs.push(["对唱", "duet"]);
    if (line.words.length > 1) tagDefs.push(["逐字", "word"]);
    if (line.language) tagDefs.push([line.language, "lang"]);
    if (line.agentId) tagDefs.push([`声部 ${line.agentId}`, "agent"]);
    if (line.songPart) tagDefs.push([line.songPart, "part"]);
    if (tagDefs.length > 0) {
      const tagWrap = document.createElement("div");
      tagWrap.className = "line-tags";
      for (const [text, kind] of tagDefs) {
        const badge = document.createElement("span");
        badge.className = `tag tag-${kind}`;
        badge.textContent = text;
        tagWrap.appendChild(badge);
      }
      bodyEl.appendChild(tagWrap);
    }

    main.appendChild(bodyEl);
    row.appendChild(main);
    row.appendChild(renderLineDetail(line));
    fragment.appendChild(row);
  }

  clearResult();
  resultEl.appendChild(fragment);
};

/** 行属性 + 逐字详情表（点击行主体切换展开） */
const renderLineDetail = (line: LyricLine): HTMLElement => {
  const detail = document.createElement("div");
  detail.className = "line-detail";

  // 行属性：单行紧凑 chips
  const attrs: Array<[string, string]> = [
    ["ID", line.id ?? "--"],
    [
      "起止",
      `${formatTime(line.startTime)} → ${formatTime(line.endTime)}（${line.endTime - line.startTime}ms）`,
    ],
    ["语言", line.language ?? "--"],
    ["背景/对唱", `${line.isBG ? "是" : "否"} / ${line.isDuet ? "是" : "否"}`],
    ["声部", line.agentId ?? "--"],
    ["结构", line.songPart ?? "--"],
    ["块索引", line.blockIndex != null ? String(line.blockIndex) : "--"],
  ];
  let html = "<div class='attr-chips'>";
  for (const [k, v] of attrs) {
    html += `<span class="attr-chip"><b>${escapeHtml(k)}</b>${escapeHtml(v)}</span>`;
  }
  html += "</div>";

  if (line.words.length > 0) {
    html += "<div class='detail-title'>逐字数据 words</div>";
    html +=
      "<table class='word-table'><thead><tr><th>词</th><th>起始</th><th>结束</th><th>时长</th><th>音译</th><th>注音</th><th>标记</th></tr></thead><tbody>";
    for (const word of line.words) {
      const flags: string[] = [];
      if (word.obscene) flags.push("不雅");
      if (word.emptyBeat) flags.push(`空拍×${word.emptyBeat}`);
      const ruby = (word.ruby ?? []).map((r) => r.word).join(" ");
      html += `<tr><td class='w'>${escapeHtml(word.word || "·")}</td><td>${word.startTime}</td><td>${word.endTime}</td><td>${word.endTime - word.startTime}ms</td><td class='r'>${escapeHtml(word.romanWord ?? "--")}</td><td class='k'>${escapeHtml(ruby || "--")}</td><td>${escapeHtml(flags.join(" / ") || "--")}</td></tr>`;
    }
    html += "</tbody></table>";
  }

  if (line.translatedLyric || line.romanLyric) {
    html += "<div class='detail-title'>行级附加文本</div><div class='attr-chips'>";
    if (line.translatedLyric) {
      html += `<span class="attr-chip"><b>translatedLyric</b>${escapeHtml(line.translatedLyric)}</span>`;
    }
    if (line.romanLyric) {
      html += `<span class="attr-chip"><b>romanLyric</b>${escapeHtml(line.romanLyric)}</span>`;
    }
    html += "</div>";
  }

  detail.innerHTML = html;
  return detail;
};

/** 元数据卡片（extractMetadata 开启且有内容时显示） */
const renderMetadata = (metadata: LyricMetadata): HTMLElement | null => {
  const fields: Array<[string, string[] | undefined]> = [
    ["标题", metadata.title],
    ["歌手", metadata.artist],
    ["专辑", metadata.album],
    ["词曲作者", metadata.songwriters],
    ["制作者", metadata.authors],
    ["制作者账号", metadata.authorNames],
    ["ISRC", metadata.isrc],
    ["语言", metadata.language ? [metadata.language] : undefined],
    ["计时模式", metadata.timingMode ? [metadata.timingMode] : undefined],
    ["时间偏移", metadata.offset ? [`${metadata.offset} ms`] : undefined],
  ];
  const rows = fields.filter(([, v]) => v && v.length > 0);
  if (rows.length === 0) return null;

  const card = document.createElement("div");
  card.className = "meta-card";
  let html = "<h4>元数据</h4>";
  html += "<table class='detail-table'><tbody>";
  for (const [label, value] of rows) {
    html += `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml((value ?? []).join(" / "))}</td></tr>`;
  }
  html += "</tbody></table>";
  if (metadata.agents && Object.keys(metadata.agents).length > 0) {
    html += "<div class='detail-title'>演唱者 agents</div><table class='detail-table'><tbody>";
    for (const agent of Object.values(metadata.agents)) {
      html += `<tr><th>${escapeHtml(agent.id)}</th><td>${escapeHtml([agent.name, agent.type].filter(Boolean).join(" · "))}</td></tr>`;
    }
    html += "</tbody></table>";
  }
  card.innerHTML = html;
  return card;
};

// ---- 流水线 ----

const trackFormat = (track: Track): LyricFormat | undefined => {
  const value =
    track === "main"
      ? state.track.mainFormat
      : track === "translation"
        ? state.track.translationFormat
        : track === "romaji"
          ? state.track.romajiFormat
          : undefined;
  return value && value !== "auto" ? (value as LyricFormat) : undefined;
};

const runParsePipeline = (): void => {
  const content = mainInput.value.trim();
  if (!content) {
    cached = null;
    showEmpty("在左侧输入或导入歌词后，这里展示解析结果");
    return;
  }

  const format: LyricFormat = trackFormat("main") ?? detectFormat(content);

  let result: LyricResult;
  try {
    result = parseLyric(
      {
        content,
        format,
        translation: translationInput.value.trim() || undefined,
        translationFormat: trackFormat("translation"),
        romaji: romajiInput.value.trim() || undefined,
        romajiFormat: trackFormat("romaji"),
        kana: kanaInput.value.trim() || undefined,
      },
      {
        format,
        detectBackground: state.parse.detectBackground,
        extractMetadata: state.parse.extractMetadata,
        cleanKangxi: state.parse.cleanKangxi,
        preferredLang: state.parse.preferredLang || undefined,
        applyOffset: state.parse.applyOffset,
        multiLineMode: state.parse.multiLineMode,
        keepEmptyLines: state.parse.keepEmptyLines,
      },
    );
  } catch (err) {
    cached = null;
    showEmpty(`解析失败：${String(err)}`);
    return;
  }

  let lines = result.lines;
  const stripOptions = buildStripOptions(state);
  if (stripOptions) lines = stripLyricMetadata(lines, stripOptions);
  if (state.clean.normalizeLines) normalizeLyricLines(lines);
  if (state.clean.applyLanguages) applyLyricLanguages(lines);
  cached = { format, result, lines };

  renderLines(lines, result.metadata);
  statAuthors.textContent =
    extractLyricAuthors(content, format).join(", ") ||
    (result.metadata.authors ?? []).join(", ") ||
    "--";
  renderSerialize(lines, result.metadata);
};

/** 单文件解析器直接调用演示 */
const runSingleParser = (): void => {
  const content = mainInput.value.trim();
  if (!content) {
    showEmpty("在左侧输入或导入歌词后，这里展示单解析器结果");
    return;
  }
  const format: LyricFormat = trackFormat("main") ?? detectFormat(content);
  const parsers: Record<LyricFormat, (text: string) => LyricResult> = {
    ttml: parseTTML,
    qrc: parseQRC,
    krc: parseKRC,
    yrc: parseYRC,
    lrc: parseLRC,
    lys: parseLyS,
    srt: parseSRT,
    ass: parseASS,
  };
  try {
    const parsed = parsers[format](content);
    cached = { format, result: parsed, lines: parsed.lines };
    statFormat.textContent = format.toUpperCase();
    statLines.textContent = String(parsed.lines.length);
    statBg.textContent = String(parsed.lines.filter((l) => l.isBG).length);
    statDuet.textContent = String(parsed.lines.filter((l) => l.isDuet).length);
    statDuration.textContent = formatTime(parsed.lines.at(-1)?.endTime ?? 0);
    statAuthors.textContent = extractLyricAuthors(content, format).join(", ") || "--";
    renderBlocks([
      {
        title: `parse${format.toUpperCase()} 独立解析器 · ${parsed.lines.length} 行`,
        rows: [
          ["首行", parsed.lines[0] ? lineMainText(parsed.lines[0]) : "--"],
          [
            "末行",
            parsed.lines.at(-1) ? lineMainText(parsed.lines.at(-1) ?? parsed.lines[0]) : "--",
          ],
        ],
      },
    ]);
    renderSerialize(parsed.lines, parsed.metadata);
  } catch (err) {
    showEmpty(`parse${format.toUpperCase()} 解析失败：${String(err)}`);
  }
};

const renderSerialize = (lines: LyricLine[], metadata: LyricMetadata): void => {
  outputTitle.textContent = `序列化输出 · serializeLyric → ${state.parse.serializeTarget.toUpperCase()}`;
  outputPre.textContent =
    serializeLyric({ lines, metadata }, state.parse.serializeTarget) || "（无有效内容）";
};

const showEmpty = (message: string): void => {
  clearResult();
  const placeholder = document.createElement("div");
  placeholder.className = "empty-placeholder";
  placeholder.textContent = message;
  resultEl.appendChild(placeholder);
  for (const el of [statFormat, statLines, statBg, statDuet, statDuration, statAuthors]) {
    el.textContent = "--";
  }
  statLines.textContent = "0";
  statBg.textContent = "0";
  statDuet.textContent = "0";
  outputPre.textContent = "（等待解析结果）";
};

interface Block {
  title: string;
  rows: Array<[string, string]>;
}

const renderBlocks = (blocks: Block[]): void => {
  clearResult();
  const fragment = document.createDocumentFragment();
  for (const block of blocks) {
    const card = document.createElement("div");
    card.className = "block-result";
    let html = `<h4>${escapeHtml(block.title)}</h4>`;
    for (const [label, value] of block.rows) {
      html += `<div class="block-row"><span class="block-label">${escapeHtml(label)}</span><code>${escapeHtml(value)}</code></div>`;
    }
    card.innerHTML = html;
    fragment.appendChild(card);
  }
  resultEl.appendChild(fragment);
};

// ---- 清洗分类：流水线开关已并入统一解析流程 ----
const runClean = (): void => {
  runParsePipeline();
};

// ---- 调度 ----
const run = (): void => {
  if (activeCategory === "parse") {
    if (state.parse.singleParser) runSingleParser();
    else runParsePipeline();
  } else {
    runClean();
  }
};

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
const scheduleRun = (): void => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(run, 300);
};

for (const input of [mainInput, translationInput, romajiInput, kanaInput]) {
  input.addEventListener("input", scheduleRun);
}

trackFileBtn.addEventListener("click", () => trackFileInput.click());
trackFileInput.addEventListener("change", async () => {
  const file = trackFileInput.files?.[0];
  if (!file) return;
  try {
    TRACK_INPUTS[activeTrack].value = await file.text();
    trackFileName.textContent = `${TRACK_LABELS[activeTrack]}：${file.name}`;
    run();
  } catch (err) {
    trackFileName.textContent = `读取失败：${file.name}`;
    console.error(err);
  }
});

btnCopy.addEventListener("click", () => {
  const text = outputPre.textContent ?? "";
  if (!text || text === "（等待解析结果）" || text === "（无有效内容）") return;
  void navigator.clipboard.writeText(text).then(() => {
    btnCopy.textContent = "已复制";
    setTimeout(() => {
      btnCopy.textContent = "复制";
    }, 1500);
  });
});

// ---- 行点击展开/收起（仅行主体区域响应，详情内点击不收起） ----
resultEl.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const head = target.closest(".line-main");
  if (!head) return;
  const row = head.closest(".lyric-line");
  row?.classList.toggle("expanded");
});

// ---- 输入轨道小 Tab ----
const TRACK_LABELS: Record<Track, string> = {
  main: "主歌词",
  translation: "翻译歌词",
  romaji: "音译歌词",
  kana: "假名注音",
};

const FORMAT_LABEL_KEYS: Record<Track, string> = {
  main: "主歌词格式",
  translation: "翻译歌词格式",
  romaji: "音译歌词格式",
  kana: "注音（无格式选择）",
};

trackTabs.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest(
    "button[data-track]",
  ) as HTMLButtonElement | null;
  if (!btn) return;
  activeTrack = btn.dataset.track as Track;
  for (const el of trackTabs.querySelectorAll("button")) {
    el.classList.toggle("active", el === btn);
  }
  for (const panel of trackPanels) {
    panel.hidden = panel.dataset.trackPanel !== activeTrack;
  }
  // 注音轨道不解析格式，隐藏格式选择
  const hasFormat = activeTrack !== "kana";
  trackFormatSelect.hidden = !hasFormat;
  trackFormatLabel.textContent = FORMAT_LABEL_KEYS[activeTrack];
  if (hasFormat) {
    trackFormatSelect.dataset.key = `track.${activeTrack}Format`;
    trackFormatSelect.value =
      (state.track as Record<string, string>)[`${activeTrack}Format`] ?? "auto";
  }
});

// ---- 分类 Tab ----
tabsBar.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest("button[data-tab]") as HTMLButtonElement | null;
  if (!btn) return;
  activeCategory = btn.dataset.tab as Category;
  for (const el of tabsBar.querySelectorAll("button")) {
    el.classList.toggle("active", el === btn);
  }
  for (const panel of tabPanels) {
    panel.hidden = panel.dataset.panel !== activeCategory;
  }
  run();
});

// ---- 面板控件事件委托 ----
for (const panel of tabPanels) {
  panel.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const key = target.dataset.key;
    if (!key) return;
    const value =
      target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : target.value;
    assignState(key, value);
    if (target instanceof HTMLInputElement && target.type === "checkbox") run();
    else scheduleRun();
  });
}

trackFormatSelect.addEventListener("change", () => {
  const key = trackFormatSelect.dataset.key;
  if (key) assignState(key, trackFormatSelect.value);
  run();
});

/** 将 "parse.format" 形式的键写入 state */
const assignState = (key: string, value: string | boolean): void => {
  const [group, field] = key.split(".");
  const target: Record<string, unknown> =
    group === "parse"
      ? state.parse
      : group === "clean"
        ? state.clean
        : group === "track"
          ? state.track
          : state.parse;
  target[field] = value;
};

run();
