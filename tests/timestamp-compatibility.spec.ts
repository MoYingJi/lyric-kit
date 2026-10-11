import { describe, expect, it } from "vitest";
import { detectFormat, parseKRC, parseLRC, parseLyric, parseSRT } from "../src/parse";
import { parseBracketTag, parseTime, parseTTMLTime } from "../src/utils/timestamp";

describe("整秒 LRC 时间戳", () => {
  it("解析网易云 JSON 元数据后的整秒正文及外部翻译、罗马音", () => {
    const { lines } = parseLyric(
      {
        content:
          '{"t":0,"c":[{"tx":"作词：测试"}]}\n[00:29]Мае рукі ў тваіх валасах,\n[00:35]А ў вочах адчай.',
        translation: "[00:29]我的双手在你的发间\n[00:35]而眼中满是绝望",
        romaji: "[00:29]mae ruki\n[00:35]a u vochakh",
      },
      { extractMetadata: true, cleanKangxi: true },
    );
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.startTime)).toEqual([29000, 35000]);
    expect(lines[0].words[0].word).toBe("Мае рукі ў тваіх валасах,");
    expect(lines.map((line) => line.translatedLyric)).toEqual([
      "我的双手在你的发间",
      "而眼中满是绝望",
    ]);
    expect(lines.map((line) => line.romanLyric)).toEqual(["mae ruki", "a u vochakh"]);
  });

  it("保留整秒、小数混用与同一行多个时间标签", () => {
    const { lines } = parseLRC("[00:01][00:03.50]重复歌词\n[00:05:250]末行");
    expect(lines.map((line) => line.startTime)).toEqual([1000, 3500, 5250]);
    expect(lines.map((line) => line.words[0].word)).toEqual(["重复歌词", "重复歌词", "末行"]);
  });

  it("解析整秒方括号和尖括号逐字标签", () => {
    const bracket = parseLRC("[00:01]你[00:02]好[00:03]").lines[0];
    const angle = parseLRC("[00:01]<00:01>你<00:02>好<00:03>").lines[0];
    for (const line of [bracket, angle]) {
      expect(line.words).toEqual([
        { word: "你", startTime: 1000, endTime: 2000 },
        { word: "好", startTime: 2000, endTime: 3000 },
      ]);
    }
  });

  it("整秒歌词仍应用偏移并正确配对同时间戳的内联翻译", () => {
    const { lines } = parseLRC("[offset:250]\n[00:01]原词\n[00:01]译文", {
      extractMetadata: true,
      applyOffset: true,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(1250);
    expect(lines[0].translatedLyric).toBe("译文");
  });

  it.each([
    ["[00:29]", 29000],
    ["[00:29.1]", 29100],
    ["[00:29.12]", 29120],
    ["[00:29:123]", 29123],
    ["[00:29.]", -1],
    ["[00:29.1234]", -1],
    ["[ti:标题]", -1],
  ])("独立标签 %s 的时间为 %i", (tag, expected) => {
    expect(parseBracketTag(tag)).toBe(expected);
  });

  it("时间工具省略小数时按零处理，并保留 KRC 毫秒的原有语义", () => {
    expect(parseTime("00", "29")).toBe(29000);
    expect(parseTime("00", "29", undefined, false)).toBe(29000);
    expect(parseTime("00", "29", "1", false)).toBe(29001);
  });
});

describe("其他格式的时间兼容", () => {
  it("KRC 兼容整秒行头，保留逐字偏移及原生毫秒行头", () => {
    const { lines } = parseKRC("[00:29]<0,500>你<500,500>好\n[35000,1000]<0,1000>再见");
    expect(lines.map((line) => line.startTime)).toEqual([29000, 35000]);
    expect(lines[0].words).toEqual([
      { word: "你", startTime: 29000, endTime: 29500 },
      { word: "好", startTime: 29500, endTime: 30000 },
    ]);
  });

  it.each([
    ["00:00:29 --> 00:00:35", 29000, 35000],
    ["00:00:29,1 --> 00:00:35.25", 29100, 35250],
    ["00:00:29,123 --> 00:00:35,456 X1:0 X2:100", 29123, 35456],
  ])("SRT 识别和解析一致：%s", (timing, start, end) => {
    const content = `1\r\n${timing}\r\n字幕`;
    expect(detectFormat(content)).toBe("srt");
    const { lines } = parseLyric(content);
    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(start);
    expect(lines[0].endTime).toBe(end);
  });

  it.each([
    "invalid --> 00:00:35,000",
    "00:00:29,000 --> invalid",
    "00:00:29,000 --> 00:00:28,000",
    "00:00:29,1234 --> 00:00:35,000",
  ])("SRT 跳过错误时间块：%s", (timing) => {
    expect(parseSRT(`1\n${timing}\n无效字幕`).lines).toHaveLength(0);
  });

  it("ASS 无 Script Info 头时仍能自动识别并解析整秒时间", () => {
    const content = "[Events]\nDialogue: 0,0:00:29,0:00:35,Default,,0,0,0,,字幕";
    expect(detectFormat(content)).toBe("ass");
    const { lines } = parseLyric(content);
    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(29000);
    expect(lines[0].endTime).toBe(35000);
  });

  it.each([
    ["1500ms", 1500],
    ["1.5s", 1500],
    ["1.5m", 90000],
    ["1.5h", 5400000],
    ["00:29", 29000],
    ["00:00:29", 29000],
    ["00:00:29.125", 29125],
  ])("TTML 时间 %s 对应 %i 毫秒", (value, expected) => {
    expect(parseTTMLTime(value)).toBe(expected);
  });

  it("TTML 的行与逐字时间均支持混合时间单位", () => {
    const { lines } = parseLyric(
      '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="0.5m" end="32500ms">' +
        '<span begin="30000ms" end="31s">你</span>' +
        '<span begin="31s" end="32500ms">好</span></p></div></body></tt>',
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(30000);
    expect(lines[0].endTime).toBe(32500);
    expect(lines[0].words).toEqual([
      { word: "你", startTime: 30000, endTime: 31000 },
      { word: "好", startTime: 31000, endTime: 32500 },
    ]);
  });

  it.each([
    ["qrc", "[29000,1000]你(29000,500)好(29500,500)"],
    ["yrc", "[29000,1000](29000,500,0)你(29500,500,0)好"],
    ["lys", "[1]你(29000,500)好(29500,500)"],
  ] as const)("%s 的原生整数毫秒格式保持兼容", (format, content) => {
    expect(detectFormat(content)).toBe(format);
    const { lines } = parseLyric(content);
    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(29000);
    expect(lines[0].endTime).toBe(30000);
    expect(lines[0].words.map((word) => word.word).join("")).toBe("你好");
  });
});
