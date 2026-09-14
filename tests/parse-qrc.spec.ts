import { describe, expect, it } from "vitest";
import { stripLyricMetadata } from "../src/clean/stripper";
import { parseQRC } from "../src/parse";

describe("parseQRC", () => {
  it("应解析纯文本格式 QRC 逐字歌词", () => {
    const text = `[1000,2000]这(1000,500)是(1500,500)测(2000,500)试(2500,500)`;
    const { lines, metadata } = parseQRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(1000);
    expect(lines[0].endTime).toBe(3000);
    expect(lines[0].words).toHaveLength(4);
    expect(lines[0].words[0]).toEqual({ word: "这", startTime: 1000, endTime: 1500 });
    expect(lines[0].words[3]).toEqual({ word: "试", startTime: 2500, endTime: 3000 });
    expect(metadata).toEqual({});
  });

  it("应正确解析 XML 包裹的 QRC 歌词并提取元数据", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<QrcInfos Title="晴天" Singer="周杰伦" Album="叶惠美">
  <Lyric_1 LyricContent="[ti:晴天]\n[2000,1000]晴(2000,500)天(2500,500)"/>
</QrcInfos>`;
    const { lines, metadata } = parseQRC(xml, { extractMetadata: true });

    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(2000);
    expect(lines[0].words.map((w) => w.word).join("")).toBe("晴天");
    expect(metadata.title).toEqual(["晴天"]);
    expect(metadata.artist).toEqual(["周杰伦"]);
    expect(metadata.album).toEqual(["叶惠美"]);
  });

  it("默认应识别背景音行并剥离括号", () => {
    const text = `[1000,2000]（和(1000,1000)声）(2000,1000)`;
    const { lines } = parseQRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].isBG).toBe(true);
    expect(lines[0].words.map((w) => w.word).join("")).toBe("和声");
  });

  it("显式 detectBackground: false 时不作为背景音处理", () => {
    const text = `[1000,2000]（和(1000,1000)声）(2000,1000)`;
    const { lines } = parseQRC(text, { detectBackground: false });

    expect(lines).toHaveLength(1);
    expect(lines[0].isBG).toBe(false);
  });

  it("应正确解析西文词间空格标记 endsWithSpace", () => {
    const text = `[1000,2000]Hello (1000,1000)World(2000,1000)`;
    const { lines } = parseQRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0].word).toBe("Hello");
    expect(lines[0].words[0].endsWithSpace).toBe(true);
    expect(lines[0].words[1].word).toBe("World");
    expect(lines[0].words[1].endsWithSpace).toBeUndefined();
  });

  it("应将独立空白词标记到前一个词的 endsWithSpace", () => {
    const text = `[1000,3000]Hello(1000,1000) (2000,1000)World(3000,1000)`;
    const { lines } = parseQRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0]).toEqual({
      word: "Hello",
      startTime: 1000,
      endTime: 2000,
      endsWithSpace: true,
    });
    expect(lines[0].words[0].endsWithSpace).toBe(true);
    expect(lines[0].words[1]).toEqual({ word: "World", startTime: 3000, endTime: 4000 });
    expect(lines[0].words[1].endsWithSpace).toBeUndefined();
  });

  it("应支持 XML 实体反转义（&#10; 换行与 &quot; 等）", () => {
    const xml = `<QrcInfos Title="&quot;晴天&quot;" Singer="周杰伦 &amp; 朋友"><Lyric_1 LyricContent="[1000,1000]晴(1000,500)天(1500,500)&#10;[2000,1000]阴(2000,500)天(2500,500)"/></QrcInfos>`;
    const { lines, metadata } = parseQRC(xml, { extractMetadata: true });

    expect(lines).toHaveLength(2);
    expect(lines[0].words.map((w) => w.word).join("")).toBe("晴天");
    expect(lines[1].words.map((w) => w.word).join("")).toBe("阴天");
    expect(metadata.title).toEqual(['"晴天"']);
    expect(metadata.artist).toEqual(["周杰伦 & 朋友"]);
    expect(metadata.timingMode).toBe("Word");
  });

  it("应正确使用 String.fromCodePoint 解码 >0xFFFF 的 Unicode 字符实体（Emoji）", () => {
    const xml = `<QrcInfos Title="&#128512;&#x1F3A4;"><Lyric_1 LyricContent="[1000,1000]歌(1000,500)词(1500,500)"/></QrcInfos>`;
    const { metadata } = parseQRC(xml, { extractMetadata: true });

    expect(metadata.title).toEqual(["😀🎤"]);
  });

  it("当 XML 包含多个 Lyric 节点时，非贪婪提取应保证只取主歌词而不吞掉后续内容", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<QrcInfos LyricCount="2">
  <Lyric_1 LyricContent="[1000,1000]原(1000,500)文(1500,500)"/>
  <Lyric_2 LyricContent="[1000,1000]翻(1000,500)译(1500,500)"/>
</QrcInfos>`;
    const { lines } = parseQRC(xml);

    expect(lines).toHaveLength(1);
    expect(lines[0].words.map((w) => w.word).join("")).toBe("原文");
  });

  it("当 QRC 歌词文本中包含未转义的英文双引号时，不应提前截断歌词", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<QrcInfos LyricCount="1">
  <Lyric_1 LyricType="1" LyricContent="[ti:测试歌曲]
[0,1000]前(0,500)奏(500,500)
[1000,1000]测(1000,500)试&quot;(1500,0)转(1500,250)义&quot;(1750,250)
[2000,1000]测(2000,500)试"(2500,0)引(2500,250)号"(2750,250)
[3000,1000]结(3000,500)尾(3500,500)
"/>
</QrcInfos>`;
    const { lines } = parseQRC(xml);

    expect(lines).toHaveLength(4);
    expect(lines[0].words.map((w) => w.word).join("")).toBe("前奏");
    expect(lines[1].words.map((w) => w.word).join("")).toBe('测试"转义"');
    expect(lines[2].words.map((w) => w.word).join("")).toBe('测试"引号"');
    expect(lines[3].words.map((w) => w.word).join("")).toBe("结尾");
  });

  it("应支持 QRC 逐字歌词首行附属背景行与制作人元数据完整清洗", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<QrcInfos>
<QrcHeadInfo SaveTime="1373437368" Version="100"/>
<LyricInfo LyricCount="1">
<Lyric_1 LyricType="1" LyricContent="[ti:晨曦微光]
[ar:风铃乐队]
[al:晨曦微光]
[by:]
[offset:0]
[0,520]晨(0,34)曦(34,34)微(68,34)光(102,34) (136,34)-(170,34) (204,34)风(238,34)铃(272,34)乐(306,34)队(340,34) (374,34)((408,34)Wind(442,34) (476,34)Bell(510,34))(544,34)
[520,530]词(520,132)：(652,132)青(784,132)石(916,132)
[1050,530]曲(1050,132)：(1182,132)木(1314,132)棉(1446,132)
[1580,520]编(1580,104)：(1684,104)白(1788,104)云(1892,104)
[2111,4060]清(2111,180)晨 (2421,870)微(3291,130)风(3421,120)吹(3541,190)过(3731,190)安(3921,180)静(4101,130)的(4231,190)山(4421,180)谷(4601,380)
[7291,1620]阳(7291,130)光(7421,120)洒(7541,190)落(7731,120)在(7851,190)小(8041,120)溪(8161,130)边(8291,190)
"/>
</LyricInfo>
</QrcInfos>`;

    const { lines, metadata } = parseQRC(xml, { extractMetadata: true });
    expect(metadata.title).toEqual(["晨曦微光"]);
    expect(metadata.artist).toEqual(["风铃乐队"]);

    const cleaned = stripLyricMetadata(lines, {
      matchMetadata: {
        title: metadata.title?.[0],
        artists: metadata.artist,
      },
    });

    expect(cleaned).toHaveLength(2);
    expect(cleaned[0].words.map((w) => w.word).join("")).toBe("清晨微风吹过安静的山谷");
    expect(cleaned[0].words[1].endsWithSpace).toBe(true);
    expect(cleaned[1].words.map((w) => w.word).join("")).toBe("阳光洒落在小溪边");
  });
});
