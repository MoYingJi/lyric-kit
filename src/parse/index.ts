import { normalizeKangxi } from "../clean/kangxi";
import { isMeaningfulTranslation } from "../clean/meaningful";
import type {
  LyricFormat,
  LyricInput,
  LyricLine,
  LyricResult,
  LyricWord,
  ParseOptions,
} from "../types";
import { applyKanaToLines } from "../utils/kana";
import { alignRomanization } from "../utils/roman";
import { parseASS } from "./ass";
import { parseKRC } from "./krc";
import { parseLRC } from "./lrc";
import { parseLyS } from "./lys";
import { parseQRC } from "./qrc";
import { parseSRT } from "./srt";
import { parseTTML } from "./ttml";
import { parseYRC } from "./yrc";

export { alignRomanization } from "../utils/roman";
export { parseASS } from "./ass";
export { parseKRC } from "./krc";
export { parseLRC } from "./lrc";
export { parseLyS } from "./lys";
export { parseQRC } from "./qrc";
export { parseSRT } from "./srt";
export type { DOMParserConstructor, DOMParserLike } from "./ttml";
export { parseTTML } from "./ttml";
export { parseYRC } from "./yrc";

/** 对齐容差（毫秒） */
const ALIGN_TOLERANCE_MS = 300;

/**
 * 根据内容特征检测歌词格式
 * @param text - 歌词文本内容
 * @returns 检测到的格式
 * @default "lrc"
 */
export const detectFormat = (text: string): LyricFormat => {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("[Script Info]") || /^\[V4\+? Styles\]/m.test(text)) return "ass";
  if (/^(?:\d+\r?\n)?\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/.test(trimmed)) return "srt";
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<")) {
    if (/LyricContent="|<QrcInfos|<Lyric_/.test(text)) return "qrc";
    if (trimmed.startsWith("<tt") || /<tt\s/i.test(text)) return "ttml";
  }
  if (/\[\d+,\d+\]\(\d+,\d+,\d+\)/.test(text)) return "yrc";
  if (/\[\d+,\d+\][^[\n]+\(\d+,\d+\)/.test(text)) return "qrc";
  if (/^\[\d\][^[\]]+\(\d+,\d+\)/m.test(text)) return "lys";
  if (/\[id:\$\d+\]/i.test(text) || /<\d+,\d+(?:,\d+)?>/.test(text)) return "krc";
  return "lrc";
};

/**
 * 根据指定格式调用对应的解析器解析歌词内容
 * @param text - 待解析的歌词文本
 * @param format - 歌词格式
 * @param options - 解析配置选项
 * @returns 解析后的歌词结果对象
 */
const parseContent = (
  text: string,
  format: LyricFormat,
  options: ParseOptions = {},
): LyricResult => {
  switch (format) {
    case "ttml":
      return parseTTML(text, options);
    case "qrc":
      return parseQRC(text, options);
    case "krc":
      return parseKRC(text, options);
    case "yrc":
      return parseYRC(text, options);
    case "lrc":
      return parseLRC(text, options);
    case "lys":
      return parseLyS(text, options);
    case "srt":
      return parseSRT(text, options);
    case "ass":
      return parseASS(text, options);
  }
};

/**
 * 获取单行歌词的所有词拼接纯文本
 * @param line - 歌词行对象
 * @returns 拼接后的纯文本字符串
 */
const lineText = (line: LyricLine): string =>
  line.words
    .map((word) => word.word)
    .join("")
    .trim();

/**
 * 判断单词数组是否包含逐字时间戳信息
 * @param words - 歌词单词数组
 * @returns 是否具备逐字时间信息
 */
const hasWordTiming = (words: LyricWord[]): boolean =>
  words.length > 1 || (words.length === 1 && words[0].endTime > words[0].startTime);

/**
 * 将翻译/音译歌词按时间戳对齐到主歌词行
 * @param lines - 主歌词行数组（原地修改）
 * @param transLines - 已解析的翻译/音译歌词行
 * @param field - 写入目标字段名称
 * @returns 无返回值（原地修改）
 */
export const pairTranslation = (
  lines: LyricLine[],
  transLines: LyricLine[],
  field: "translatedLyric" | "romanLyric",
): void => {
  const trans = [...transLines].sort((lineA, lineB) => lineA.startTime - lineB.startTime);
  let mainIndex = 0;
  let transIndex = 0;
  while (mainIndex < lines.length && transIndex < trans.length) {
    const diff = lines[mainIndex].startTime - trans[transIndex].startTime;
    if (Math.abs(diff) <= ALIGN_TOLERANCE_MS) {
      const text = lineText(trans[transIndex]);
      if (isMeaningfulTranslation(text)) lines[mainIndex][field] = text;
      if (
        field === "romanLyric" &&
        hasWordTiming(lines[mainIndex].words) &&
        hasWordTiming(trans[transIndex].words)
      ) {
        alignRomanization(lines[mainIndex].words, trans[transIndex].words);
      }
      mainIndex++;
      transIndex++;
    } else if (diff < 0) {
      mainIndex++;
    } else {
      transIndex++;
    }
  }
};

/**
 * 解析歌词主入口函数
 * @param input - 歌词输入载荷（纯文本字符串或 LyricInput 载荷对象）
 * @param options - 解析配置选项
 * @returns 歌词解析结果
 */
export const parseLyric = (input: string | LyricInput, options: ParseOptions = {}): LyricResult => {
  const payload: LyricInput = typeof input === "string" ? { content: input } : input;
  const { format } = options;
  const actualFormat = format ?? payload.format ?? detectFormat(payload.content);

  // QRC/KRC 的 kana 按原始基字符计数，外部注音也必须在部首归一化前对齐。
  const deferKangxi =
    payload.kana && options.cleanKangxi && (actualFormat === "qrc" || actualFormat === "krc");
  const mainResult = parseContent(
    payload.content,
    actualFormat,
    deferKangxi ? { ...options, cleanKangxi: false } : options,
  );
  const lines = mainResult.lines;

  if (payload.translation) {
    const transFormat = payload.translationFormat ?? detectFormat(payload.translation);
    pairTranslation(
      lines,
      parseContent(payload.translation, transFormat, options).lines,
      "translatedLyric",
    );
  }

  if (payload.romaji) {
    const romajiFormat = payload.romajiFormat ?? detectFormat(payload.romaji);
    pairTranslation(lines, parseContent(payload.romaji, romajiFormat, options).lines, "romanLyric");
  }

  if (payload.kana) {
    applyKanaToLines(lines, payload.kana);
  }

  if (deferKangxi) {
    for (const line of lines) {
      for (const word of line.words) word.word = normalizeKangxi(word.word);
    }
  }

  return {
    lines,
    metadata: mainResult.metadata,
  };
};
