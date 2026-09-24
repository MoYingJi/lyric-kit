import { describe, expect, it } from "vitest";
import { parseLRC, parseLyric, parseQRC } from "../src/parse";
import type { LyricLine } from "../src/types";
import { splitTrailingBackground } from "../src/utils/bg";

describe("kana 数字串与康熙部首", () => {
  it.each(["30", "３０"])("数字串 %s 的注音覆盖整个词的时间", (digits) => {
    const result = parseQRC(`[kana:1さんじゅう]\n[100,1000]${digits}(100,1000)`);
    expect(result.lines[0].words[0].ruby).toEqual([
      { word: "さんじゅう", startTime: 100, endTime: 1100 },
    ]);
  });

  it("同一词内多个数字串的注音按各自完整长度计时", () => {
    const result = parseQRC(`[kana:1にじゅうに1さんさん]\n[100,600]A22B33(100,600)`);
    expect(result.lines[0].words[0].ruby).toEqual([
      { word: "にじゅうに", startTime: 200, endTime: 400 },
      { word: "さんさん", startTime: 500, endTime: 700 },
    ]);
  });

  it.each([
    { format: "qrc" as const, content: "[0,200]⾔(0,100)躍(100,100)" },
    { format: "krc" as const, content: "[0,200]<0,100>⾔<100,100>躍" },
  ])("$format 外部 kana 在康熙部首归一化前对齐", ({ format, content }) => {
    for (const cleanKangxi of [false, true]) {
      const result = parseLyric({ content, kana: "[kana:1おど]" }, { format, cleanKangxi });
      const words = result.lines[0].words;
      expect(words[0].word).toBe(cleanKangxi ? "言" : "⾔");
      expect(words[0].ruby).toBeUndefined();
      expect(words[1].ruby).toEqual([{ word: "おど", startTime: 100, endTime: 200 }]);
    }
  });
});

describe("LRC 翻译过滤", () => {
  it.each(["//", "以下歌词翻译由文曲大模型提供"])(
    "过滤翻译 %s 后仍保留罗马音的位置",
    (translation) => {
      const { lines } = parseLRC(
        `[00:01.00]こんにちは\n[00:01.00]${translation}\n[00:01.00]konnichiwa\n[00:02.00]再见`,
      );
      expect(lines).toHaveLength(2);
      expect(lines[0].translatedLyric).toBe("");
      expect(lines[0].romanLyric).toBe("konnichiwa");
      expect(lines[1].words[0].word).toBe("再见");
    },
  );
});

describe("Issue #4 词内尾随和声", () => {
  it.each([
    { texts: ["主", "歌", "词（", "和", "声", "）"], bgStart: 300 },
    { texts: ["主歌词（", "和声", "）"], bgStart: 100 },
    { texts: ["主", "歌词（和", "声）"], bgStart: 100 },
  ])("保留左括号所在词中的正文：$texts", ({ texts, bgStart }) => {
    const words = texts.map((word, i) => ({ word, startTime: i * 100, endTime: (i + 1) * 100 }));
    const line: LyricLine = {
      words,
      startTime: 0,
      endTime: texts.length * 100,
      translatedLyric: "",
      romanLyric: "",
      isBG: false,
      isDuet: false,
    };
    const background = splitTrailingBackground(line);
    expect(line.words.map((word) => word.word).join("")).toBe("主歌词");
    expect(background?.words.map((word) => word.word).join("")).toBe("和声");
    expect(line.endTime).toBe(texts.findIndex((text) => text.includes("（")) * 100 + 100);
    expect(background?.startTime).toBe(bgStart);
    expect(background?.endTime).toBe(texts.length * 100);
    expect(background?.words.every((word) => word.word && word.startTime <= word.endTime)).toBe(
      true,
    );
    expect(words.map((word) => word.word)).toEqual(texts);
  });

  it("真实 QRC 中歌手名后的括号不应吞掉歌手名及其时间", () => {
    const { lines } = parseQRC(
      "[176,1752]ア(176,152)ド(328,168)レ(496,168)ナ(664,76) - (740,76)YOASOBI ((817,487)ヨ(1304,160)ア(1464,144)ソ(1608,160)ビ(1768,160))(1928,0)",
    );
    expect(lines).toHaveLength(2);
    expect(lines[0].words.map((word) => word.word).join("")).toBe("アドレナ - YOASOBI");
    expect(lines[0].endTime).toBe(1304);
    expect(lines[1].words.map((word) => word.word).join("")).toBe("ヨアソビ");
    expect(lines[1].startTime).toBe(1304);
    expect(lines[1].endTime).toBe(1928);
  });

  it("词内括号为日文注音时不拆分且不修改原行", () => {
    const { lines } = parseQRC("[0,500]明(0,100)日（(100,100)あした(200,200)）(400,100)");
    expect(lines).toHaveLength(1);
    expect(lines[0].words.map((word) => word.word).join("")).toBe("明日（あした）");
    expect(lines[0].endTime).toBe(500);
  });
});
