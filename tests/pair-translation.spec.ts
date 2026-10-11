import { describe, expect, it } from "vitest";
import { pairTranslation, parseLyric } from "../src/parse";
import type { LyricLine } from "../src/types";

const line = (startTime: number, word: string, isBG = false): LyricLine => ({
  startTime,
  endTime: startTime + 500,
  words: [{ word, startTime, endTime: startTime + 500 }],
  isBG,
  isDuet: false,
  translatedLyric: "",
  romanLyric: "",
});

describe("外部翻译对齐", () => {
  it("密集重复时间戳与乱序输入的结果与朴素参考实现一致", () => {
    let seed = 42;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    for (let run = 0; run < 100; run++) {
      const main = Array.from({ length: 30 }, (_, i) =>
        line((random() % 12) * 100, `主${i}`, (random() & 2) !== 0),
      );
      const trans = Array.from({ length: 25 }, (_, i) =>
        line((random() % 24) * 50, `译${i}`, (random() & 2) !== 0),
      );
      const expected = structuredClone(main);
      const used = new Set<number>();
      const usedTrans = new Set<LyricLine>();
      const pending: LyricLine[] = [];
      const assign = (index: number, item: LyricLine) => {
        used.add(index);
        usedTrans.add(item);
        expected[index].translatedLyric = item.words[0].word;
      };
      for (const item of [...trans].sort((a, b) => a.startTime - b.startTime)) {
        const exact = expected.findIndex(
          (target, i) =>
            !used.has(i) && target.isBG === item.isBG && target.startTime === item.startTime,
        );
        if (exact >= 0) assign(exact, item);
        else pending.push(item);
      }
      for (const item of pending) {
        const candidates = expected
          .map((target, index) => ({
            target,
            index,
            distance: Math.abs(target.startTime - item.startTime),
          }))
          .filter(
            ({ target, index, distance }) =>
              !used.has(index) && target.isBG === item.isBG && distance <= 300,
          )
          .sort(
            (a, b) =>
              a.distance - b.distance ||
              a.target.startTime - b.target.startTime ||
              a.index - b.index,
          );
        if (candidates[0]) assign(candidates[0].index, item);
      }
      const fallback: LyricLine[] = [];
      for (const item of [...trans].sort((a, b) => a.startTime - b.startTime)) {
        if (usedTrans.has(item)) continue;
        const exact = expected.findIndex(
          (target, i) => !used.has(i) && target.startTime === item.startTime,
        );
        if (exact >= 0) assign(exact, item);
        else fallback.push(item);
      }
      for (const item of fallback) {
        const candidates = expected
          .map((target, index) => ({
            target,
            index,
            distance: Math.abs(target.startTime - item.startTime),
          }))
          .filter(({ index, distance }) => !used.has(index) && distance <= 300)
          .sort(
            (a, b) =>
              a.distance - b.distance ||
              a.target.startTime - b.target.startTime ||
              a.index - b.index,
          );
        if (candidates[0]) assign(candidates[0].index, item);
      }
      pairTranslation(main, trans, "translatedLyric");
      expect(main).toEqual(expected);
    }
  });

  it("精确时间戳优先于前一行的容差匹配", () => {
    const { lines } = parseLyric({
      content: "[00:01.00]A\n[00:01.20]B",
      translation: "[00:01.20]B的翻译",
    });
    expect(lines.map((item) => item.translatedLyric)).toEqual(["", "B的翻译"]);
  });

  it("外部翻译没有声部标记时保留原有时间匹配行为", () => {
    const { lines } = parseLyric({ content: "[00:01.00](Echo)", translation: "[00:01.00]回声" });
    expect(lines[0].isBG).toBe(true);
    expect(lines[0].translatedLyric).toBe("回声");
  });

  it("提前保留精确匹配，避免较早的偏移翻译抢占", () => {
    const main = [line(1000, "A"), line(1200, "B")];
    pairTranslation(main, [line(1190, "A译"), line(1200, "B译")], "translatedLyric");
    expect(main.map((item) => item.translatedLyric)).toEqual(["A译", "B译"]);
  });

  it("无精确匹配时选择最近且未使用的同声部行，并保留数组顺序", () => {
    const main = [line(1500, "B"), line(1000, "A"), line(1200, "BG", true)];
    const original = [...main];
    pairTranslation(main, [line(1280, "B译"), line(1210, "和声译", true)], "translatedLyric");
    expect(main.map((item) => item.translatedLyric)).toEqual(["B译", "", "和声译"]);
    expect(main).toEqual(original);
  });

  it("边界容差包含 300ms，超出时不匹配，同距时保留较早行", () => {
    const main = [line(1000, "A"), line(1500, "B"), line(3000, "C")];
    pairTranslation(
      main,
      [line(1250, "A译"), line(1800, "B译"), line(3301, "无匹配")],
      "translatedLyric",
    );
    expect(main.map((item) => item.translatedLyric)).toEqual(["A译", "B译", ""]);
  });

  it("同时间戳按声部对齐，并继续支持逐词罗马音", () => {
    const main = [line(1000, "主"), line(1000, "和", true)];
    pairTranslation(main, [line(1000, "echo", true), line(1000, "main")], "romanLyric");
    expect(main.map((item) => item.romanLyric)).toEqual(["main", "echo"]);
    expect(main.map((item) => item.words[0].romanWord)).toEqual(["main", "echo"]);
  });
});
