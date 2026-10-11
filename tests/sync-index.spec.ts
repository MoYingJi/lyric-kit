import { describe, expect, it } from "vitest";
import type { LyricLine } from "../src/types";
import { createActiveLyricFinder, findActiveLyricIndices } from "../src/utils/sync";

const line = (startTime: number, endTime: number): LyricLine => ({
  startTime,
  endTime,
  words: [],
  translatedLyric: "",
  romanLyric: "",
  isBG: false,
  isDuet: false,
});

describe("高频激活行索引", () => {
  it("重叠、间隙、零时长、边界与跳转查询均保持原函数结果", () => {
    const lines = [
      line(0, 10000),
      line(100, 200),
      line(100, 500),
      line(500, 500),
      line(1000, 1200),
    ];
    const find = createActiveLyricFinder(lines);
    for (const time of [
      10001,
      0,
      -1,
      100,
      200,
      499,
      500,
      501,
      1000,
      1200,
      10000,
      NaN,
      Infinity,
      -Infinity,
    ]) {
      expect(find(time)).toEqual(findActiveLyricIndices(lines, time));
    }
    expect(createActiveLyricFinder([])(100)).toEqual([]);
  });

  it("随机重叠歌词与线性参考实现逐项一致", () => {
    let seed = 2026;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    for (let run = 0; run < 100; run++) {
      const lines = Array.from({ length: 100 }, () => {
        const start = random() % 20000;
        return line(start, start + (random() % 5000));
      }).sort((a, b) => a.startTime - b.startTime);
      const original = structuredClone(lines);
      const find = createActiveLyricFinder(lines);
      for (let query = 0; query < 100; query++) {
        const time = (random() % 30000) - 1000;
        expect(find(time)).toEqual(findActiveLyricIndices(lines, time));
      }
      expect(lines).toEqual(original);
    }
  });

  it("快照不随调用方修改而失效，重建后使用新时间", () => {
    const lines = [line(1000, 2000)];
    const find = createActiveLyricFinder(lines);
    lines[0].startTime = 3000;
    lines[0].endTime = 4000;
    expect(find(1500)).toEqual([0]);
    expect(createActiveLyricFinder(lines)(1500)).toEqual([]);
    const result = find(1500);
    result.length = 0;
    expect(find(1500)).toEqual([0]);
  });
});
