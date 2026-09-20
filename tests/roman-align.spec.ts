import { describe, expect, it } from "vitest";
import type { LyricWord } from "../src";
import { alignRomanization, parseLyric } from "../src";

describe("逐字罗马音/拼音对齐 (alignRomanization)", () => {
  it("应能实现基础的 1 对 1 逐词精准对齐", () => {
    const mainWords: LyricWord[] = [
      { word: "最", startTime: 0, endTime: 8 },
      { word: "佳", startTime: 8, endTime: 16 },
      { word: "损", startTime: 16, endTime: 24 },
      { word: "友", startTime: 24, endTime: 32 },
    ];

    const romanWords: LyricWord[] = [
      { word: "zeoi ", startTime: 0, endTime: 8 },
      { word: "gai ", startTime: 8, endTime: 16 },
      { word: "sun ", startTime: 16, endTime: 24 },
      { word: "you ", startTime: 24, endTime: 32 },
    ];

    alignRomanization(mainWords, romanWords);

    expect(mainWords[0].romanWord).toBe("zeoi");
    expect(mainWords[1].romanWord).toBe("gai");
    expect(mainWords[2].romanWord).toBe("sun");
    expect(mainWords[3].romanWord).toBe("you");
  });

  it("应支持单个汉字对应多个音节时的自动拼接合并", () => {
    const mainWords: LyricWord[] = [
      { word: "世", startTime: 2885, endTime: 2964 },
      { word: "界", startTime: 2964, endTime: 3500 },
      { word: "に", startTime: 3500, endTime: 3643 },
      { word: "今日", startTime: 3643, endTime: 4082 },
      { word: "も", startTime: 4082, endTime: 4174 },
    ];

    // “界” 对应 "ka" (2963, 296) 与 "i" (3259, 240)
    // “今日” 对应 "kyo" (3642, 146) 与 "u" (3935, 146)
    const romanWords: LyricWord[] = [
      { word: "se ", startTime: 2884, endTime: 2962 },
      { word: "ka ", startTime: 2963, endTime: 3259 },
      { word: "i ", startTime: 3259, endTime: 3499 },
      { word: "ni ", startTime: 3500, endTime: 3642 },
      { word: "kyo ", startTime: 3642, endTime: 3788 },
      { word: "u ", startTime: 3935, endTime: 4081 },
      { word: "mo ", startTime: 4081, endTime: 4173 },
    ];

    alignRomanization(mainWords, romanWords);

    expect(mainWords[0].romanWord).toBe("se");
    expect(mainWords[1].romanWord).toBe("kai");
    expect(mainWords[2].romanWord).toBe("ni");
    expect(mainWords[3].romanWord).toBe("kyou");
    expect(mainWords[4].romanWord).toBe("mo");
  });

  it("当包含超短词（如 3ms）或容差边界时，不应误剪枝或发生错位", () => {
    const mainWords: LyricWord[] = [
      { word: "れ", startTime: 106337, endTime: 106595 },
      { word: "が", startTime: 106596, endTime: 106599 },
      { word: "間", startTime: 106599, endTime: 106754 },
    ];

    const romanWords: LyricWord[] = [
      { word: "re ", startTime: 106337, endTime: 106595 },
      { word: "ga ", startTime: 106596, endTime: 106598 },
      { word: "ma ", startTime: 106599, endTime: 106752 },
    ];

    alignRomanization(mainWords, romanWords);

    expect(mainWords[0].romanWord).toBe("re");
    expect(mainWords[1].romanWord).toBe("ga");
    expect(mainWords[2].romanWord).toBe("ma");
  });

  it("当输入为空数组时应安全返回且不抛出异常", () => {
    const emptyMain: LyricWord[] = [];
    const validRoman: LyricWord[] = [{ word: "test", startTime: 0, endTime: 100 }];
    alignRomanization(emptyMain, validRoman);
    expect(emptyMain).toHaveLength(0);

    const validMain: LyricWord[] = [{ word: "测试", startTime: 0, endTime: 100 }];
    const emptyRoman: LyricWord[] = [];
    alignRomanization(validMain, emptyRoman);
    expect(validMain[0].romanWord).toBeUndefined();
  });
});

describe("多轨逐字歌词解析集成 (parseLyric with romaji)", () => {
  it("应在传入包含逐字 romaji 的 QRC 载荷时，自动挂载 romanLyric 与 words.romanWord", () => {
    const qrcMain = [
      '<?xml version="1.0" encoding="utf-8"?>',
      "<QrcInfos>",
      '<LyricInfo LyricCount="1">',
      '<Lyric_1 LyricType="1" LyricContent="[ti:怪物]',
      "[offset:0]",
      "[2128,2725]素(2128,14)晴(2142,50)ら(2192,360)し(2552,239)き(2791,94)世(2885,79)界(2964,536)に(3500,143)",
      '"/>',
      "</LyricInfo>",
      "</QrcInfos>",
    ].join("\n");

    const qrcRomaji = [
      '<?xml version="1.0" encoding="utf-8"?>',
      "<QrcInfos>",
      '<LyricInfo LyricCount="1">',
      '<Lyric_1 LyricType="1" LyricContent="[ti:怪物]',
      "[offset:0]",
      "[2128,2725]su (2128,13)ba (2141,49)ra (2191,360)shi (2552,238)ki (2790,94)se (2884,78)ka (2963,296)i (3259,240)ni (3500,142)",
      '"/>',
      "</LyricInfo>",
      "</QrcInfos>",
    ].join("\n");

    const result = parseLyric({
      content: qrcMain,
      romaji: qrcRomaji,
    });

    expect(result.lines).toHaveLength(1);
    const targetLine = result.lines[0];

    // 整行罗马音
    expect(targetLine.romanLyric).toBe("su ba ra shi ki se ka i ni");

    // 逐字音节
    expect(targetLine.words).toHaveLength(8);
    expect(targetLine.words[0].word).toBe("素");
    expect(targetLine.words[0].romanWord).toBe("su");
    expect(targetLine.words[1].word).toBe("晴");
    expect(targetLine.words[1].romanWord).toBe("ba");
    expect(targetLine.words[2].word).toBe("ら");
    expect(targetLine.words[2].romanWord).toBe("ra");
    expect(targetLine.words[3].word).toBe("し");
    expect(targetLine.words[3].romanWord).toBe("shi");
    expect(targetLine.words[4].word).toBe("き");
    expect(targetLine.words[4].romanWord).toBe("ki");
    expect(targetLine.words[5].word).toBe("世");
    expect(targetLine.words[5].romanWord).toBe("se");
    expect(targetLine.words[6].word).toBe("界");
    expect(targetLine.words[6].romanWord).toBe("kai");
    expect(targetLine.words[7].word).toBe("に");
    expect(targetLine.words[7].romanWord).toBe("ni");
  });

  it("当主歌词为逐字而罗马音为普通逐行 LRC 时，应平滑降级（保留整行 romanLyric，不挂载 romanWord）", () => {
    const qrcMain = [
      '<?xml version="1.0" encoding="utf-8"?>',
      "<QrcInfos>",
      '<LyricInfo LyricCount="1">',
      '<Lyric_1 LyricType="1" LyricContent="[ti:测试]',
      "[1000,2000]你(1000,1000)好(2000,1000)",
      '"/>',
      "</LyricInfo>",
      "</QrcInfos>",
    ].join("\n");

    const lrcRomaji = "[00:01.00]ni hao\n";

    const result = parseLyric({
      content: qrcMain,
      romaji: lrcRomaji,
    });

    expect(result.lines).toHaveLength(1);
    const targetLine = result.lines[0];

    // 整行保留
    expect(targetLine.romanLyric).toBe("ni hao");

    // 单词不产生 romanWord
    expect(targetLine.words[0].romanWord).toBeUndefined();
    expect(targetLine.words[1].romanWord).toBeUndefined();
  });

  it("当主歌词与罗马音均为单字逐词时应成功挂载", () => {
    const qrcMain = [
      '<?xml version="1.0" encoding="utf-8"?>',
      "<QrcInfos>",
      '<LyricInfo LyricCount="1">',
      '<Lyric_1 LyricType="1" LyricContent="[1000,1000]啊(1000,1000)"/>',
      "</LyricInfo>",
      "</QrcInfos>",
    ].join("\n");

    const qrcRomaji = [
      '<?xml version="1.0" encoding="utf-8"?>',
      "<QrcInfos>",
      '<LyricInfo LyricCount="1">',
      '<Lyric_1 LyricType="1" LyricContent="[1000,1000]a(1000,1000)"/>',
      "</LyricInfo>",
      "</QrcInfos>",
    ].join("\n");

    const result = parseLyric({ content: qrcMain, romaji: qrcRomaji });
    expect(result.lines[0].words[0].romanWord).toBe("a");
  });

  it("支持粤拼逐词对齐并保留英文与标点", () => {
    const qrcMain = [
      '<?xml version="1.0" encoding="utf-8"?>',
      "<QrcInfos>",
      '<LyricInfo LyricCount="1">',
      '<Lyric_1 LyricType="1" LyricContent="[130,130]词(130,26)：(156,26)黄(182,26)伟(208,26)文(234,26)"/>',
      "</LyricInfo>",
      "</QrcInfos>",
    ].join("\n");

    const qrcRomaji = [
      '<?xml version="1.0" encoding="utf-8"?>',
      "<QrcInfos>",
      '<LyricInfo LyricCount="1">',
      '<Lyric_1 LyricType="1" LyricContent="[130,130]ci (130,26)：(156,26)wong (182,26)wai (208,26)man (234,26)"/>',
      "</LyricInfo>",
      "</QrcInfos>",
    ].join("\n");

    const result = parseLyric({ content: qrcMain, romaji: qrcRomaji });
    const line = result.lines[0];
    expect(line.words[0].word).toBe("词");
    expect(line.words[0].romanWord).toBe("ci");
    expect(line.words[1].word).toBe("：");
    expect(line.words[1].romanWord).toBe("：");
    expect(line.words[2].word).toBe("黄");
    expect(line.words[2].romanWord).toBe("wong");
    expect(line.words[3].word).toBe("伟");
    expect(line.words[3].romanWord).toBe("wai");
    expect(line.words[4].word).toBe("文");
    expect(line.words[4].romanWord).toBe("man");
  });

  it("当罗马音时间戳偏离超过容差（300ms）时安全跳过不发生错误对齐", () => {
    const qrcMain = [
      '<?xml version="1.0" encoding="utf-8"?>',
      "<QrcInfos>",
      '<LyricInfo LyricCount="1">',
      '<Lyric_1 LyricType="1" LyricContent="[1000,500]歌(1000,500)"/>',
      "</LyricInfo>",
      "</QrcInfos>",
    ].join("\n");

    const qrcRomaji = [
      '<?xml version="1.0" encoding="utf-8"?>',
      "<QrcInfos>",
      '<LyricInfo LyricCount="1">',
      '<Lyric_1 LyricType="1" LyricContent="[5000,500]ge(5000,500)"/>',
      "</LyricInfo>",
      "</QrcInfos>",
    ].join("\n");

    const result = parseLyric({ content: qrcMain, romaji: qrcRomaji });
    expect(result.lines[0].romanLyric).toBe("");
    expect(result.lines[0].words[0].romanWord).toBeUndefined();
  });
});
