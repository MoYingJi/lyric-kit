import { describe, expect, it } from "vitest";
import { serializeLyric, toEnhancedLRC, toLRC, toSRT, toTTML } from "../src/serialize";
import type { LyricLine } from "../src/types";

const mockLines: LyricLine[] = [
  {
    startTime: 1000,
    endTime: 3000,
    words: [
      { startTime: 1000, endTime: 2000, word: "你" },
      { startTime: 2000, endTime: 3000, word: "好" },
    ],
    translatedLyric: "Hello",
    romanLyric: "Nihao",
    isBG: false,
    isDuet: false,
  },
];

describe("serialize", () => {
  it("toLRC 应输出标准 LRC 格式与双语行及罗马音", () => {
    const lrc = toLRC(mockLines);
    expect(lrc).toBe("[00:01.00]你好\n[00:01.00]Hello\n[00:01.00]Nihao");
  });

  it("toEnhancedLRC 应输出带有内联时间戳的逐字 LRC 与罗马音", () => {
    const elrc = toEnhancedLRC(mockLines);
    expect(elrc).toBe("[00:01.00]<00:01.00>你<00:02.00>好\n[00:01.00]Hello\n[00:01.00]Nihao");
  });

  it("toLRC 与 toEnhancedLRC 应将 isBG 行用括号包裹", () => {
    const bgLines: LyricLine[] = [
      {
        startTime: 1000,
        endTime: 3000,
        words: [{ startTime: 1000, endTime: 3000, word: "和声" }],
        translatedLyric: "",
        romanLyric: "",
        isBG: true,
        isDuet: false,
      },
    ];
    expect(toLRC(bgLines)).toBe("[00:01.00](和声)");
    expect(toEnhancedLRC(bgLines)).toBe("[00:01.00](<00:01.00>和声)");
  });

  it("toTTML 应输出标准 XML 并包含 begin/end", () => {
    const ttml = toTTML(mockLines);
    expect(ttml).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(ttml).toContain('<span begin="00:01.000" end="00:02.000">你</span>');
    expect(ttml).toContain('<span begin="00:02.000" end="00:03.000">好</span>');
    expect(ttml).toContain('<span ttm:role="x-translation">Hello</span>');
  });

  it("toSRT 应输出编号与时间轴块", () => {
    const srt = toSRT(mockLines);
    expect(srt).toBe("1\n00:00:01,000 --> 00:00:03,000\nNihao\nHello\n你好");
  });

  it("serializeLyric 统一入口支持直接接收 LyricLine[] 与自动导出", () => {
    expect(serializeLyric(mockLines, "lrc")).toBe(toLRC(mockLines));
    expect(serializeLyric(mockLines, "elrc")).toBe(toEnhancedLRC(mockLines));
    expect(serializeLyric(mockLines, "ttml")).toBe(toTTML(mockLines));
    expect(serializeLyric(mockLines, "srt")).toBe(toSRT(mockLines));
  });

  it("toEnhancedLRC 应正确导出词间空格", () => {
    const lines: LyricLine[] = [
      {
        startTime: 1000,
        endTime: 3000,
        words: [
          { startTime: 1000, endTime: 2000, word: "Hello " },
          { startTime: 2000, endTime: 3000, word: "World" },
        ],
        translatedLyric: "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
      },
    ];
    const elrc = toEnhancedLRC(lines);
    expect(elrc).toBe("[00:01.00]<00:01.00>Hello <00:02.00>World");
  });

  it("toSRT 应正确导出词间空格，防止西文单词粘连", () => {
    const lines: LyricLine[] = [
      {
        startTime: 1000,
        endTime: 3000,
        words: [
          { startTime: 1000, endTime: 2000, word: "Hello " },
          { startTime: 2000, endTime: 3000, word: "World" },
        ],
        translatedLyric: "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
      },
    ];
    const srt = toSRT(lines);
    expect(srt).toContain("Hello World");
    expect(srt).not.toContain("HelloWorld");
  });

  it("toTTML 应支持导出 tts:ruby、songPart 与 AMLL 特性", () => {
    const lines: LyricLine[] = [
      {
        startTime: 1000,
        endTime: 3000,
        songPart: "Chorus",
        words: [
          {
            startTime: 1000,
            endTime: 2000,
            word: "漢字 ",
            ruby: [
              { word: "かん", startTime: 1000, endTime: 1500 },
              { word: "じ", startTime: 1500, endTime: 2000 },
            ],
          },
          {
            startTime: 2000,
            endTime: 3000,
            word: "Rock",
            obscene: true,
            emptyBeat: 2,
          },
        ],
        translatedLyric: "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
      },
    ];
    const ttml = toTTML(lines);
    expect(ttml).toContain('itunes:song-part="Chorus"');
    expect(ttml).toContain('tts:ruby="container"');
    expect(ttml).toContain('tts:ruby="base"');
    expect(ttml).toContain('tts:ruby="text"');
    expect(ttml).toContain("かん");
    expect(ttml).toContain("じ");
    expect(ttml).toContain('amll:obscene="true"');
    expect(ttml).toContain('amll:empty-beat="2"');
  });

  it("toTTML 应输出包含 begin/end 的背景人声标签与 metadata head", () => {
    const lines: LyricLine[] = [
      {
        startTime: 1000,
        endTime: 3000,
        words: [{ startTime: 1000, endTime: 3000, word: "主旋律" }],
        translatedLyric: "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
      },
      {
        startTime: 1500,
        endTime: 2500,
        words: [{ startTime: 1500, endTime: 2500, word: "和声" }],
        translatedLyric: "harmony",
        romanLyric: "",
        isBG: true,
        isDuet: false,
      },
    ];

    const ttml = toTTML({
      lines,
      metadata: {
        title: ["测试曲目"],
        artist: ["演唱者"],
        album: ["测试专辑"],
        songwriters: ["词曲作者"],
        agents: {
          v1: { id: "v1", name: "演唱者", type: "person" },
        },
      },
    });

    expect(ttml).toContain('<span ttm:role="x-bg" begin="00:01.500" end="00:02.500">');
    expect(ttml).toContain("<head>");
    expect(ttml).toContain("<metadata>");
    expect(ttml).toContain('<amll:meta key="musicName" value="测试曲目" />');
    expect(ttml).toContain('<amll:meta key="artists" value="演唱者" />');
    expect(ttml).toContain('<amll:meta key="album" value="测试专辑" />');
    expect(ttml).toContain("<itunes:songwriter>词曲作者</itunes:songwriter>");
    expect(ttml).toContain('<ttm:agent type="person" xml:id="v1">');
    expect(ttml).toContain('<ttm:name type="full">演唱者</ttm:name>');
  });

  it("serializeLyric 应支持直接传入裸字符串并透传 options", () => {
    const rawLrc = "[00:01.00]第一句\n[00:02.00]第二句";
    const res = serializeLyric(rawLrc, "lrc");
    expect(res).toBe("[00:01.00]第一句\n[00:02.00]第二句");

    // 测试透传 options.cleanKangxi
    const kangxiLrc = "[00:01.00]⾦"; // 康熙部首 U+2F95
    const resClean = serializeLyric(kangxiLrc, "lrc", { cleanKangxi: true });
    expect(resClean).toBe("[00:01.00]金"); // 还原为标准汉字 U+91D1
  });

  it("toTTML 中 escapeXml 应转义双引号和单引号，防止属性值断裂", () => {
    const ttml = toTTML({
      lines: [
        {
          startTime: 1000,
          endTime: 2000,
          words: [{ startTime: 1000, endTime: 2000, word: 'He said "Hello"' }],
          translatedLyric: "",
          romanLyric: "",
          isBG: false,
          isDuet: false,
          songPart: 'Part "A"',
        },
      ],
      metadata: {
        title: ['Song "Title"'],
      },
    });

    expect(ttml).toContain('itunes:song-part="Part &quot;A&quot;"');
    expect(ttml).toContain('<amll:meta key="musicName" value="Song &quot;Title&quot;" />');
  });

  it("toTTML 应为背景人声行序列化翻译与音译，且不在 p 标签上冗余输出 song-part", () => {
    const ttml = toTTML({
      lines: [
        {
          startTime: 1000,
          endTime: 3000,
          words: [{ startTime: 1000, endTime: 3000, word: "主歌" }],
          translatedLyric: "Main verse",
          romanLyric: "Zhuge",
          isBG: false,
          isDuet: false,
          songPart: "Verse 1",
        },
        {
          startTime: 1500,
          endTime: 2500,
          words: [{ startTime: 1500, endTime: 2500, word: "和声" }],
          translatedLyric: "Harmony",
          romanLyric: "Hesheng",
          isBG: true,
          isDuet: false,
          songPart: "Verse 1",
        },
      ],
      metadata: {},
    });

    expect(ttml).toContain('<div itunes:song-part="Verse 1">');
    expect(ttml).not.toContain("<p itunes:song-part=");
    expect(ttml).toContain('<span ttm:role="x-bg"');
    expect(ttml).toContain('<span ttm:role="x-translation">Harmony</span>');
    expect(ttml).toContain('<span ttm:role="x-roman">Hesheng</span>');
  });
});
