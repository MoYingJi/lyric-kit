import { describe, expect, it } from "vitest";
import { parseYRC } from "../src/parse";

describe("parseYRC", () => {
  it("应解析网易云 YRC 逐字歌词", () => {
    const text = `[500,2000](500,500,0)网(1000,500,0)易(1500,500,0)云(2000,500,0)歌(2500,0,0)`;
    const { lines, metadata } = parseYRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(500);
    expect(lines[0].endTime).toBe(2500);
    expect(lines[0].words).toHaveLength(4);
    expect(lines[0].words[0]).toEqual({ word: "网", startTime: 500, endTime: 1000 });
    expect(lines[0].words[2]).toEqual({ word: "云", startTime: 1500, endTime: 2000 });
    expect(lines[0].words[3]).toEqual({ word: "歌", startTime: 2000, endTime: 2500 });
    expect(metadata).toEqual({});
  });

  it("应处理多行 YRC", () => {
    const text = `[100,1000](100,500,0)A(600,500,0)B\n[1200,1000](1200,500,0)C(1700,500,0)D`;
    const { lines } = parseYRC(text);

    expect(lines).toHaveLength(2);
    expect(lines[0].startTime).toBe(100);
    expect(lines[1].startTime).toBe(1200);
  });

  it("应支持提取 YRC 元数据", () => {
    const text = `[ti:晴天]\n[ar:周杰伦]\n[100,1000](100,500,0)A(600,500,0)B`;
    const { lines, metadata } = parseYRC(text, { extractMetadata: true });

    expect(lines).toHaveLength(1);
    expect(metadata.title).toEqual(["晴天"]);
    expect(metadata.artist).toEqual(["周杰伦"]);
  });

  it("应正确提取西文词间空格", () => {
    const text = `[0,2000](0,500,0)Hello (500,500,0)World`;
    const { lines } = parseYRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0].word).toBe("Hello ");
    expect(lines[0].words[1].word).toBe("World");
  });

  it("应保留独立空白词", () => {
    const text = `[0,2000](0,500,0)Hello(500,500,0) (1000,500,0)World`;
    const { lines } = parseYRC(text);

    expect(lines[0].startTime).toBe(0);
    expect(lines[0].endTime).toBe(2000);
    expect(lines[0].words).toHaveLength(3);
    expect(lines[0].words[0]).toEqual({
      word: "Hello",
      startTime: 0,
      endTime: 500,
    });
    expect(lines[0].words[1]).toEqual({ word: " ", startTime: 500, endTime: 1000 });
    expect(lines[0].words[2]).toEqual({ word: "World", startTime: 1000, endTime: 1500 });
  });

  it("应支持提取网易云首行 JSON 格式词曲元数据", () => {
    const text = `[0,0]{"t":0,"c":[{"tx":"作词 : 方文山"},{"tx":"作曲 : 周杰伦"},{"tx":"歌手 : 周杰伦"}]}\n[100,1000](100,500,0)A(600,500,0)B`;
    const { lines, metadata } = parseYRC(text, { extractMetadata: true });

    expect(lines).toHaveLength(1);
    expect(metadata.timingMode).toBe("Word");
    expect(metadata.songwriters).toEqual(["方文山", "周杰伦"]);
    expect(metadata.artist).toEqual(["周杰伦"]);
  });

  it("应正确解析包含英文冒号或多个冒号的元数据内容（取最靠前的冒号分割）", () => {
    const text = `[0,0]{"t":0,"c":[{"tx":"作曲：John: Smith"},{"tx":"歌手: Jack: Daniel"}]}\n[100,1000](100,500,0)A(600,500,0)B`;
    const { metadata } = parseYRC(text, { extractMetadata: true });

    expect(metadata.songwriters).toEqual(["John: Smith"]);
    expect(metadata.artist).toEqual(["Jack: Daniel"]);
  });
});
