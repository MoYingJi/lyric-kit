import { describe, expect, it } from "vitest";
import { parseLyS } from "../src/parse";

describe("parseLyS", () => {
  it("应正确解析 LyS 歌词并解析属性码", () => {
    const text = `[2]对唱行(1000,1000)
[6]背景行(2000,1000)
[0]普通行(3000,1000)`;

    const { lines, metadata } = parseLyS(text);

    expect(lines).toHaveLength(3);
    expect(metadata).toEqual({});

    // 属性码 2：对唱行
    expect(lines[0].isDuet).toBe(true);
    expect(lines[0].isBG).toBe(false);
    expect(lines[0].words[0].word).toBe("对唱行");

    // 属性码 6：背景行
    expect(lines[1].isBG).toBe(true);
    expect(lines[1].isDuet).toBe(false);
    expect(lines[1].words[0].word).toBe("背景行");

    // 属性码 0：普通行
    expect(lines[2].isBG).toBe(false);
    expect(lines[2].isDuet).toBe(false);
  });

  it("应支持西文空格 endsWithSpace 与括号启发式背景检测", () => {
    const text = `[0]Hello (1000,1000)World(2000,1000)
[0](和声部分)(3000,1000)`;

    const defaultResult = parseLyS(text);
    expect(defaultResult.lines[0].words[0].word).toBe("Hello");
    expect(defaultResult.lines[0].words[0].endsWithSpace).toBe(true);
    expect(defaultResult.lines[1].isBG).toBe(true);

    const bgDisabledResult = parseLyS(text, { detectBackground: false });
    expect(bgDisabledResult.lines[1].isBG).toBe(false);
  });

  it("应将独立空白词标记到前一个词的 endsWithSpace", () => {
    const text = `[0]Hello(1000,1000) (2000,1000)World(3000,1000)`;
    const { lines } = parseLyS(text);

    expect(lines[0].startTime).toBe(1000);
    expect(lines[0].endTime).toBe(4000);
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0]).toEqual({
      word: "Hello",
      startTime: 1000,
      endTime: 2000,
      endsWithSpace: true,
    });
    expect(lines[0].words[1]).toEqual({ word: "World", startTime: 3000, endTime: 4000 });
  });

  it("应支持提取 LyS 头部元数据标签", () => {
    const text = `[ti:测试歌曲]\n[ar:测试歌手]\n[0]第一句(1000,1000)`;
    const { lines, metadata } = parseLyS(text, { extractMetadata: true });

    expect(lines).toHaveLength(1);
    expect(metadata.title).toEqual(["测试歌曲"]);
    expect(metadata.artist).toEqual(["测试歌手"]);
    expect(metadata.timingMode).toBe("Word");
  });
});
