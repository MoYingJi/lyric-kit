import type { LyricLine } from "../types";
import { getLineText } from "../utils/text";
import { formatLrcTime } from "../utils/timestamp";

/**
 * 将背景人声文本包裹括号，防止回读与翻译冲突
 * @param text - 原始文本
 * @returns 括号包裹后的文本
 */
const formatBgText = (text: string): string => {
  const trimmed = text.trim();
  if (
    (trimmed.startsWith("(") && trimmed.endsWith(")")) ||
    (trimmed.startsWith("（") && trimmed.endsWith("）"))
  ) {
    return text;
  }
  return `(${text})`;
};

/**
 * 将歌词行序列化为标准逐行 LRC 格式
 * @param lines - 歌词行数组
 * @returns LRC 格式字符串
 */
export const toLRC = (lines: LyricLine[]): string => {
  const out: string[] = [];
  for (const line of lines) {
    let text = getLineText(line);
    if (!text) continue;
    if (line.isBG) text = formatBgText(text);
    const ts = `[${formatLrcTime(line.startTime)}]`;
    out.push(`${ts}${text}`);
    if (line.translatedLyric) out.push(`${ts}${line.translatedLyric}`);
    if (line.romanLyric) out.push(`${ts}${line.romanLyric}`);
  }
  return out.join("\n");
};

/**
 * 将歌词行序列化为逐字增强型 LRC 格式
 * @param lines - 歌词行数组
 * @returns 增强型 LRC 格式字符串
 */
export const toEnhancedLRC = (lines: LyricLine[]): string => {
  const out: string[] = [];
  for (const line of lines) {
    if (line.words.length === 0) continue;
    const lineTs = `[${formatLrcTime(line.startTime)}]`;
    let body = line.words.map((word) => `<${formatLrcTime(word.startTime)}>${word.word}`).join("");
    if (!body.trim()) continue;
    if (line.isBG) body = formatBgText(body);
    out.push(`${lineTs}${body}`);
    if (line.translatedLyric) out.push(`${lineTs}${line.translatedLyric}`);
    if (line.romanLyric) out.push(`${lineTs}${line.romanLyric}`);
  }
  return out.join("\n");
};
