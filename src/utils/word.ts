import type { LyricWord } from "../types";

/**
 * 清洗并添加单词到歌词单词数组中，自动处理前后空格并标记 endsWithSpace
 * @param words - 目标单词数组
 * @param rawWord - 原始文本（可能带前后空格）
 * @param startTime - 单词起始时间（毫秒）
 * @param endTime - 单词结束时间（毫秒）
 * @returns 是否成功添加了有效词
 */
export const pushCleanWord = (
  words: LyricWord[],
  rawWord: string,
  startTime: number,
  endTime: number,
): boolean => {
  const startsWithSpace = /^\s/.test(rawWord);
  const endsWithSpace = /\s$/.test(rawWord);
  const cleanWord = rawWord.trim();

  if (!cleanWord) {
    if (rawWord && words.length > 0) {
      words[words.length - 1].endsWithSpace = true;
    }
    return false;
  }

  if (startsWithSpace && words.length > 0) {
    words[words.length - 1].endsWithSpace = true;
  }

  const wordObj: LyricWord = {
    word: cleanWord,
    startTime,
    endTime,
  };

  if (endsWithSpace) {
    wordObj.endsWithSpace = true;
  }

  words.push(wordObj);
  return true;
};
