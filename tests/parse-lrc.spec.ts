import { describe, expect, it } from "vitest";
import { parseLRC, parseLyric } from "../src/parse";

describe("parseLRC", () => {
  it("应正确解析标准逐行 LRC 并按时间排序", () => {
    const text = `[ar:周杰伦]\n[00:03.00]第三句\n[00:01.00]第一句\n[00:02.00]第二句`;
    const { lines, metadata } = parseLRC(text);

    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.startTime)).toEqual([1000, 2000, 3000]);
    expect(lines[0].words[0].word).toBe("第一句");
    expect(lines[0].endTime).toBe(2000);
    expect(lines[1].endTime).toBe(3000);
    expect(metadata).toEqual({});
  });

  it("应支持提取 LRC 元数据标签", () => {
    const text = `[ti:晴天]\n[ar:周杰伦]\n[al:叶惠美]\n[by:lyricist]\n[offset:500]\n[00:01.00]故事的小黄花`;
    const { lines, metadata } = parseLRC(text, { extractMetadata: true });

    expect(lines).toHaveLength(1);
    expect(metadata.title).toEqual(["晴天"]);
    expect(metadata.artist).toEqual(["周杰伦"]);
    expect(metadata.album).toEqual(["叶惠美"]);
    expect(metadata.authors).toEqual(["lyricist"]);
    expect(metadata.offset).toBe(500);
  });

  it("应支持多时间戳展开", () => {
    const text = `[00:01.00][00:05.00]副歌重复行`;
    const { lines } = parseLRC(text);

    expect(lines).toHaveLength(2);
    expect(lines[0].startTime).toBe(1000);
    expect(lines[1].startTime).toBe(5000);
    expect(lines[0].words[0].word).toBe("副歌重复行");
  });

  it("应解析 ESLRC 尖括号逐字时间", () => {
    const text = `[00:01.00]<00:01.00>你<00:01.30>好<00:01.80>世<00:02.20>界<00:02.60>`;
    const { lines } = parseLRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].words).toHaveLength(4);
    expect(lines[0].words[0]).toEqual({
      word: "你",
      startTime: 1000,
      endTime: 1300,
    });
    expect(lines[0].words[3]).toEqual({
      word: "界",
      startTime: 2200,
      endTime: 2600,
    });
    expect(lines[0].endTime).toBe(2600);
  });

  it("应解析标准 ESLyric 方括号逐字时间", () => {
    const text = `[00:10.00][00:10.00]你[00:10.50]好[00:11.00]世[00:11.50]界[00:12.00]`;
    const { lines } = parseLRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].words).toHaveLength(4);
    expect(lines[0].words[0].word).toBe("你");
    expect(lines[0].words[0].startTime).toBe(10000);
    expect(lines[0].words[0].endTime).toBe(10500);
    expect(lines[0].words[3].word).toBe("界");
    expect(lines[0].words[3].startTime).toBe(11500);
    expect(lines[0].words[3].endTime).toBe(12000);
  });

  it("应通过 parseLyric 成功对齐翻译与音译", () => {
    const { lines } = parseLyric({
      content: "[00:01.00]Hello\n[00:03.00]Goodbye",
      translation: "[00:01.05]你好\n[00:03.00]再见",
      romaji: "[00:01.00]haro\n[00:03.05]gubbai",
    });

    expect(lines).toHaveLength(2);
    expect(lines[0].translatedLyric).toBe("你好");
    expect(lines[0].romanLyric).toBe("haro");
    expect(lines[1].translatedLyric).toBe("再见");
    expect(lines[1].romanLyric).toBe("gubbai");
  });

  it("默认应启用 detectBackground 并拆分行内尾随和声为独立背景音行", () => {
    const text = `[00:01.00]<00:01.00>主歌词<00:01.50>(<00:01.50>和声部分<00:02.00>)`;
    const { lines } = parseLRC(text);

    expect(lines).toHaveLength(2);
    expect(lines[0].isBG).toBe(false);
    expect(lines[0].words.map((w) => w.word).join("")).toBe("主歌词");
    expect(lines[1].isBG).toBe(true);
    expect(lines[1].words.map((w) => w.word).join("")).toBe("和声部分");
  });

  it("显式 detectBackground: false 时不拆分尾随括号内容", () => {
    const text = `[00:01.00]<00:01.00>主歌词<00:01.50>(<00:01.50>和声部分<00:02.00>)`;
    const { lines } = parseLRC(text, { detectBackground: false });

    expect(lines).toHaveLength(1);
    expect(lines[0].isBG).toBe(false);
  });

  it("应解析带空格的 ESLRC 逐字歌词并标记 endsWithSpace", () => {
    const text = `[00:01.00]<00:01.00>Hello <00:01.50>World<00:02.00>`;
    const { lines } = parseLRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0].word).toBe("Hello");
    expect(lines[0].words[0].endsWithSpace).toBe(true);
    expect(lines[0].words[1].word).toBe("World");
    expect(lines[0].words[1].endsWithSpace).toBeUndefined();
  });

  it("应将尖括号格式的独立空白词标记到前一个词", () => {
    const text = `[00:01.00]<00:01.00>Hello<00:01.50> <00:02.00>World<00:02.50>`;
    const { lines } = parseLRC(text);

    expect(lines[0].startTime).toBe(1000);
    expect(lines[0].endTime).toBe(2500);
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0]).toEqual({
      word: "Hello",
      startTime: 1000,
      endTime: 2000,
      endsWithSpace: true,
    });
    expect(lines[0].words[1]).toEqual({ word: "World", startTime: 2000, endTime: 2500 });
  });

  it("应将方括号格式的独立空白词标记到前一个词", () => {
    const text = `[00:01.00]Hello[00:01.50] [00:02.00]World[00:02.50]`;
    const { lines } = parseLRC(text);

    expect(lines[0].startTime).toBe(1000);
    expect(lines[0].endTime).toBe(2500);
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0]).toEqual({
      word: "Hello",
      startTime: 1000,
      endTime: 1500,
      endsWithSpace: true,
    });
    expect(lines[0].words[1]).toEqual({ word: "World", startTime: 2000, endTime: 2500 });
  });

  it("最后一行未提供结束时间时，应回退为 +8000ms 而非 16.7 小时", () => {
    const text = `[00:10.00]只有一句歌词`;
    const { lines } = parseLRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(10000);
    expect(lines[0].endTime).toBe(18000);
  });

  it("空行不应包含在结果行中，但应在倒序扫描时正确截断前一行的 endTime", () => {
    const text = `[00:10.00]第一句\n[00:15.00]\n[00:30.00]第二句`;
    const { lines } = parseLRC(text);

    expect(lines).toHaveLength(2);
    expect(lines[0].words[0].word).toBe("第一句");
    expect(lines[0].startTime).toBe(10000);
    expect(lines[0].endTime).toBe(15000);

    expect(lines[1].words[0].word).toBe("第二句");
    expect(lines[1].startTime).toBe(30000);
    expect(lines[1].endTime).toBe(38000);
  });

  it("指定 keepEmptyLines: true 时应保留间奏空行，起止时间界定完整间奏区间", () => {
    const text = `[00:10.00]第一句\n[00:15.00]\n[00:30.00]第二句`;
    const { lines } = parseLRC(text, { keepEmptyLines: true });

    expect(lines).toHaveLength(3);
    expect(lines[0].words[0].word).toBe("第一句");
    expect(lines[0].startTime).toBe(10000);
    expect(lines[0].endTime).toBe(15000);

    expect(lines[1].words[0].word).toBe("");
    expect(lines[1].startTime).toBe(15000);
    expect(lines[1].endTime).toBe(30000);

    expect(lines[2].words[0].word).toBe("第二句");
    expect(lines[2].startTime).toBe(30000);
    expect(lines[2].endTime).toBe(38000);
  });

  it("支持 applyOffset 选项将 offset 应用到所有行与词中", () => {
    const text = `[offset:500]\n[00:01.00]<00:01.00>你<00:02.00>好`;
    const { lines } = parseLRC(text, { extractMetadata: true, applyOffset: true });

    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(15000 / 10 + 0); // 1000 + 500 = 1500
    expect(lines[0].startTime).toBe(1500);
    expect(lines[0].words[0].startTime).toBe(1500);
    expect(lines[0].words[0].endTime).toBe(2500);
  });

  it("多时间戳逐字行应正确平移复制行的逐词时间戳", () => {
    const text = `[00:01.00][00:05.00]<00:01.00>重复<00:02.00>词<00:03.00>`;
    const { lines } = parseLRC(text);

    expect(lines).toHaveLength(2);
    expect(lines[0].startTime).toBe(1000);
    expect(lines[0].words[0].startTime).toBe(1000);
    expect(lines[0].words[1].startTime).toBe(2000);

    // 第二句在 5000ms，相对偏移 4000ms
    expect(lines[1].startTime).toBe(5000);
    expect(lines[1].words[0].startTime).toBe(5000);
    expect(lines[1].words[1].startTime).toBe(6000);
    expect(lines[1].words[1].endTime).toBe(7000);
  });

  it("空行与正文具有相同时间戳时，正文行不应丢失", () => {
    const text = `[00:10.00]\n[00:10.00]First line\n[00:20.00]Second`;
    const { lines } = parseLRC(text);

    expect(lines).toHaveLength(2);
    expect(lines[0].words[0].word).toBe("First line");
    expect(lines[0].startTime).toBe(10000);
    expect(lines[0].endTime).toBe(20000);

    expect(lines[1].words[0].word).toBe("Second");
    expect(lines[1].startTime).toBe(20000);
  });

  it("正文与随后的同时间戳空行并存时，正文行不应丢失", () => {
    const text = `[00:10.00]First line\n[00:10.00]\n[00:20.00]Second`;
    const { lines } = parseLRC(text);

    expect(lines).toHaveLength(2);
    expect(lines[0].words[0].word).toBe("First line");
    expect(lines[0].startTime).toBe(10000);
    expect(lines[0].endTime).toBe(20000);

    expect(lines[1].words[0].word).toBe("Second");
  });
});
