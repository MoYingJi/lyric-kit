import { describe, expect, it } from "vitest";
import { parseLRC, parseSRT } from "../src/parse";
import { serializeLyric, toEnhancedLRC, toLRC, toSRT } from "../src/serialize";
import type { LyricLine } from "../src/types";

const makeLine = (
  translatedLyric = "你好",
  romanLyric = "konnichiwa",
  isBG = false,
): LyricLine => ({
  startTime: 1000,
  endTime: 2000,
  words: [{ word: "こんにちは", startTime: 1000, endTime: 2000 }],
  translatedLyric,
  romanLyric,
  isBG,
  isDuet: false,
});

describe("LRC 字段归属", () => {
  it.each([false, true])("往返模式保留 isBG=%s 的翻译和罗马音", (isBG) => {
    for (const translation of ["你好", ""]) {
      for (const roman of ["konnichiwa", ""]) {
        const line = makeLine(translation, roman, isBG);
        const output = toLRC([line], { roundTrip: true });
        const { lines } = parseLRC(output);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({ isBG, translatedLyric: translation, romanLyric: roman });
        expect(lines[0].words[0].word).toBe(line.words[0].word);
        expect(serializeLyric([line], "lrc", { roundTrip: true })).toBe(output);
      }
    }
  });

  it("同时间戳主唱和伴唱的字段互不污染", () => {
    const input = [makeLine("主译", "main"), makeLine("和声译", "echo", true)];
    const before = structuredClone(input);
    const result = parseLRC(toLRC(input, { roundTrip: true }));
    expect(
      result.lines.map(({ isBG, translatedLyric, romanLyric }) => ({
        isBG,
        translatedLyric,
        romanLyric,
      })),
    ).toEqual(
      input.map(({ isBG, translatedLyric, romanLyric }) => ({ isBG, translatedLyric, romanLyric })),
    );
    expect(input).toEqual(before);
    expect(toLRC([makeLine("", "roman")])).toBe("[00:01.00]こんにちは\n[00:01.00]roman");
  });
});

describe("增强 LRC 往返时间", () => {
  it.each([false, true])("保留 isBG=%s 的末词结束时间与字段", (isBG) => {
    for (const translation of ["你好", ""]) {
      const input = [makeLine(translation, "konnichiwa", isBG)];
      const original = structuredClone(input);
      const output = toEnhancedLRC(input, { roundTrip: true });
      expect(parseLRC(output).lines).toEqual(input);
      expect(serializeLyric(input, "elrc", { roundTrip: true })).toBe(output);
      expect(input).toEqual(original);
    }
  });

  it("保留词间间隙和空格，末词结束不被延长到下一行", () => {
    const first = makeLine("", "");
    first.words = [
      { word: "Hello ", startTime: 1000, endTime: 1300 },
      { word: "World", startTime: 1600, endTime: 2000 },
    ];
    const second = {
      ...makeLine("", ""),
      startTime: 5000,
      endTime: 6000,
      words: [{ word: "Next", startTime: 5000, endTime: 6000 }],
    };
    expect(parseLRC(toEnhancedLRC([first, second], { roundTrip: true })).lines).toEqual([
      first,
      second,
    ]);
    expect(toEnhancedLRC([makeLine("", "")])).toBe("[00:01.00]<00:01.00>こんにちは");
  });
});

describe("SRT 兼容性与往返导出", () => {
  it("默认输出保持原来的字幕展示顺序", () => {
    expect(toSRT([makeLine()])).toBe(
      "1\n00:00:01,000 --> 00:00:02,000\nkonnichiwa\n你好\nこんにちは",
    );
  });

  it.each([
    ["你好", "konnichiwa"],
    ["", "konnichiwa"],
    ["你好", ""],
    ["", ""],
  ])("显式往返模式保留翻译 %s 和罗马音 %s 的位置", (translation, roman) => {
    const input = [makeLine(translation, roman)];
    const before = structuredClone(input);
    const output = toSRT(input, { roundTrip: true });
    expect(parseSRT(output, { multiLineMode: "bilingual" }).lines).toEqual(input);
    expect(serializeLyric(input, "srt", { roundTrip: true })).toBe(output);
    expect(input).toEqual(before);
  });
});
