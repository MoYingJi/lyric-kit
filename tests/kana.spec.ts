import { describe, expect, it } from "vitest";
import { parseLyric } from "../src/parse";
import { parseKRC } from "../src/parse/krc";
import { parseQRC } from "../src/parse/qrc";
import { toTTML } from "../src/serialize/ttml";
import { parseKanaUnits } from "../src/utils/kana";

describe("Kana / Ruby Furigana Support", () => {
  describe("parseKanaUnits", () => {
    it("应当正确解析纯假名注音单元与多字单元", () => {
      const kanaTag = "[kana:1かい1ぶつ2きょう]";
      const units = parseKanaUnits(kanaTag);

      expect(units).toHaveLength(3);
      expect(units[0]).toEqual({ kanjiCount: 1, kanaText: "かい", spans: undefined });
      expect(units[1]).toEqual({ kanjiCount: 1, kanaText: "ぶつ", spans: undefined });
      expect(units[2]).toEqual({ kanjiCount: 2, kanaText: "きょう", spans: undefined });
    });

    it("应当正确解析带细分时间戳的假名单元", () => {
      const kanaTag = "[kana:1か(2964,296)い(3260,240)]";
      const units = parseKanaUnits(kanaTag);

      expect(units).toHaveLength(1);
      expect(units[0].kanjiCount).toBe(1);
      expect(units[0].kanaText).toBe("かい");
      expect(units[0].spans).toEqual([
        { word: "か", startTime: 2964, endTime: 3260 },
        { word: "い", startTime: 3260, endTime: 3500 },
      ]);
    });

    it("应当正确处理无注音的纯数字占位符", () => {
      const kanaTag = "[kana:1しん111111きょく]";
      const units = parseKanaUnits(kanaTag);

      expect(units[0]).toEqual({ kanjiCount: 1, kanaText: "しん", spans: undefined });
      // 中间 5 个 1 占位
      expect(units[1]).toEqual({ kanjiCount: 1, kanaText: "", spans: undefined });
      expect(units[2]).toEqual({ kanjiCount: 1, kanaText: "", spans: undefined });
      expect(units[3]).toEqual({ kanjiCount: 1, kanaText: "", spans: undefined });
      expect(units[4]).toEqual({ kanjiCount: 1, kanaText: "", spans: undefined });
      expect(units[5]).toEqual({ kanjiCount: 1, kanaText: "", spans: undefined });
      expect(units[6]).toEqual({ kanjiCount: 1, kanaText: "きょく", spans: undefined });
    });
  });

  describe("parseQRC with Kana", () => {
    it("应当将 QRC 中的 [kana:...] 正确绑定到对应汉字的 word.ruby", () => {
      const qrcText = `<?xml version="1.0" encoding="utf-8"?>
<QrcInfos>
<LyricInfo LyricCount="1">
<Lyric_1 LyricType="1" LyricContent="[ti:怪物]
[ar:YOASOBI]
[offset:0]
[kana:1かい1ぶつ1す1ば1せ1か(2964,296)い(3260,240)2きょう]
[0,666]怪(0,121)物(121,121)
[2128,2725]素(2128,14)晴(2142,50)ら(2192,360)し(2552,239)き(2791,94)世(2885,79)界(2964,536)に(3500,143)今日(3643,439)
"/>
</LyricInfo>
</QrcInfos>`;

      const result = parseQRC(qrcText);
      expect(result.lines).toHaveLength(2);

      // 第一行: "怪" (かい), "物" (ぶつ)
      const line1 = result.lines[0];
      expect(line1.words[0].word).toBe("怪");
      expect(line1.words[0].ruby).toEqual([{ word: "かい", startTime: 0, endTime: 121 }]);
      expect(line1.words[1].word).toBe("物");
      expect(line1.words[1].ruby).toEqual([{ word: "ぶつ", startTime: 121, endTime: 242 }]);

      // 第二行:
      const line2 = result.lines[1];
      // "素" (す)
      expect(line2.words[0].word).toBe("素");
      expect(line2.words[0].ruby).toEqual([{ word: "す", startTime: 2128, endTime: 2142 }]);
      // "晴" (ば)
      expect(line2.words[1].word).toBe("晴");
      expect(line2.words[1].ruby).toEqual([{ word: "ば", startTime: 2142, endTime: 2192 }]);
      // "ら", "し", "き" 无注音
      expect(line2.words[2].word).toBe("ら");
      expect(line2.words[2].ruby).toBeUndefined();
      // "世" (せ)
      expect(line2.words[5].word).toBe("世");
      expect(line2.words[5].ruby).toEqual([{ word: "せ", startTime: 2885, endTime: 2964 }]);
      // "界" (か(2964,296)い(3260,240)) 带细分时间戳
      expect(line2.words[6].word).toBe("界");
      expect(line2.words[6].ruby).toEqual([
        { word: "か", startTime: 2964, endTime: 3260 },
        { word: "い", startTime: 3260, endTime: 3500 },
      ]);
      // "今日" (2きょう) 2字联合
      expect(line2.words[8].word).toBe("今日");
      expect(line2.words[8].ruby).toEqual([{ word: "きょう", startTime: 3643, endTime: 4082 }]);
    });

    it("解析包含汉字叠字 々 的歌词能够精确对齐注音", () => {
      const qrcText = `[offset:0]
[kana:1い1ひ1び1れん1ぞく]
[1000,3000]生(1000,500)日(1500,500)々(2000,500)連(2500,500)続(3000,1000)`;

      const result = parseQRC(qrcText);
      const line = result.lines[0];
      expect(line.words[0].word).toBe("生");
      expect(line.words[0].ruby?.[0].word).toBe("い");
      expect(line.words[1].word).toBe("日");
      expect(line.words[1].ruby?.[0].word).toBe("ひ");
      expect(line.words[2].word).toBe("々");
      expect(line.words[2].ruby?.[0].word).toBe("び");
      expect(line.words[3].word).toBe("連");
      expect(line.words[3].ruby?.[0].word).toBe("れん");
      expect(line.words[4].word).toBe("続");
      expect(line.words[4].ruby?.[0].word).toBe("ぞく");
    });

    it("无 [kana:] 标签的普通 QRC 歌词不受影响", () => {
      const qrcText = `[0,1000]Hello(0,500) World(500,500)`;
      const result = parseQRC(qrcText);
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].words[0].ruby).toBeUndefined();
    });

    it("应在康熙部首归一化前判断 kana 基础字符", () => {
      const qrcText = `[offset:0]
[kana:1は(150865,168)な(151033,252)1お(153326,189)ど(153515,243)]
[150865,1633]離(150865,420)さ(151285,168)な(151453,260)い(151713,268)と(151981,249)⾔(152230,38)う(152268,230)
[152498,2173]((152498,192)Memento (152690,328)mori)(153018,308)躍(153326,432)る(153758,177)よ(153935,78)う(154013,78)に(154091,580)`;

      const result = parseQRC(qrcText, { cleanKangxi: true });
      const [line0, line1] = result.lines;
      expect(line0.words[0].word).toBe("離");
      expect(line0.words[0].ruby?.map((ruby) => ruby.word)).toEqual(["は", "な"]);
      expect(line0.words[5].word).toBe("言");
      expect(line0.words[5].ruby).toBeUndefined();
      expect(line1.words[3].word).toBe("躍");
      expect(line1.words[3].ruby?.map((ruby) => ruby.word)).toEqual(["お", "ど"]);
    });
  });

  describe("parseKRC with Kana", () => {
    it("应当支持 KRC 格式中的 [kana:...] 标签", () => {
      const krcText = `[offset:0]
[kana:1しん1たから1じ(992,157)ま(1149,77)]
[320,3474]<0,197>新<197,475>宝<672,234>島`;

      const result = parseKRC(krcText);
      expect(result.lines).toHaveLength(1);
      const line = result.lines[0];
      expect(line.words[0].word).toBe("新");
      expect(line.words[0].ruby?.[0].word).toBe("しん");
      expect(line.words[1].word).toBe("宝");
      expect(line.words[1].ruby?.[0].word).toBe("たから");
      expect(line.words[2].word).toBe("島");
      expect(line.words[2].ruby).toEqual([
        { word: "じ", startTime: 992, endTime: 1149 },
        { word: "ま", startTime: 1149, endTime: 1226 },
      ]);
    });
  });

  describe("toTTML with QRC-parsed ruby", () => {
    it("经 parseQRC 解析出的带 ruby 歌词可无缝序列化为标准 TTML", () => {
      const qrcText = `[offset:0]
[kana:1かい1ぶつ]
[0,1000]怪(0,500)物(500,500)`;

      const result = parseQRC(qrcText);
      const ttmlXml = toTTML(result);

      expect(ttmlXml).toContain('tts:ruby="container"');
      expect(ttmlXml).toContain('tts:ruby="base">怪</span>');
      expect(ttmlXml).toContain('tts:ruby="text" begin="00:00.000" end="00:00.500">かい</span>');
      expect(ttmlXml).toContain('tts:ruby="base">物</span>');
      expect(ttmlXml).toContain('tts:ruby="text" begin="00:00.500" end="00:01.000">ぶつ</span>');
    });
  });

  describe("parseLyric with LyricInput payload", () => {
    it("支持在 LyricInput 对象载荷中传入独立的 kana 属性", () => {
      const result = parseLyric({
        content: "[0,1000]怪(0,500)物(500,500)",
        kana: "[kana:1かい1ぶつ]",
      });

      expect(result.lines[0].words[0].word).toBe("怪");
      expect(result.lines[0].words[0].ruby?.[0].word).toBe("かい");
      expect(result.lines[0].words[1].word).toBe("物");
      expect(result.lines[0].words[1].ruby?.[0].word).toBe("ぶつ");
    });

    it("开启 applyOffset 时应同步将 offset 累加至 word.ruby 的起止时间", () => {
      const qrcText = `[offset:500]
[kana:1かい1ぶつ]
[1000,1000]怪(1000,500)物(1500,500)`;

      const result = parseQRC(qrcText, { extractMetadata: true, applyOffset: true });
      const line = result.lines[0];
      expect(line.startTime).toBe(1500);
      expect(line.endTime).toBe(2500);
      expect(line.words[0].startTime).toBe(1500);
      expect(line.words[0].endTime).toBe(2000);
      expect(line.words[0].ruby?.[0]).toEqual({
        word: "かい",
        startTime: 1500,
        endTime: 2000,
      });
      expect(line.words[1].ruby?.[0]).toEqual({
        word: "ぶつ",
        startTime: 2000,
        endTime: 2500,
      });
    });
  });
});
