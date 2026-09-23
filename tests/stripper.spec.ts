import { describe, expect, it } from "vitest";
import { stripLyricMetadata } from "../src/clean/stripper";
import type { LyricLine } from "../src/types";

const makeLine = (text: string, start = 0): LyricLine => ({
  words: [{ startTime: start, endTime: start + 1000, word: text }],
  translatedLyric: "",
  romanLyric: "",
  startTime: start,
  endTime: start + 1000,
  isBG: false,
  isDuet: false,
});

describe("stripLyricMetadata", () => {
  it("应剥离头部的制作人/词曲作者行", () => {
    const lines = [
      makeLine("词：方文山"),
      makeLine("曲：周杰伦"),
      makeLine("编曲：钟兴民"),
      makeLine("海风轻拂着发梢"),
      makeLine("带来夏天的味道"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(2);
    expect(stripped[0].words[0].word).toBe("海风轻拂着发梢");
  });

  it("应剥离尾部的版权与出品声明", () => {
    const lines = [
      makeLine("第一句真正的歌词"),
      makeLine("第二句真正的歌词"),
      makeLine("出品：杰威尔音乐"),
      makeLine("未经著作权人许可不得翻唱"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(2);
    expect(stripped[1].words[0].word).toBe("第二句真正的歌词");
  });

  it("应支持首行「歌曲名 - 歌手名」匹配剔除", () => {
    const lines = [
      makeLine("晴天 - 周杰伦"),
      makeLine("故事的小黄花"),
      makeLine("从出生那年就飘着"),
    ];

    const stripped = stripLyricMetadata(lines, {
      matchMetadata: {
        title: "晴天",
        artists: ["周杰伦"],
      },
    });

    expect(stripped).toHaveLength(2);
    expect(stripped[0].words[0].word).toBe("故事的小黄花");
  });

  it("元数据行占满开头时，靠后的「歌曲名 - 歌手名」行仍应被匹配剔除", () => {
    const lines = [
      makeLine("词：方文山"),
      makeLine("曲：周杰伦"),
      makeLine("编曲：钟兴民"),
      makeLine("录音：xxx"),
      makeLine("混音：xxx"),
      makeLine("晴天 - 周杰伦"),
      makeLine("故事的小黄花"),
    ];

    const stripped = stripLyricMetadata(lines, {
      matchMetadata: {
        title: "晴天",
        artists: ["周杰伦"],
      },
    });

    expect(stripped).toHaveLength(1);
    expect(stripped[0].words[0].word).toBe("故事的小黄花");
  });

  it("默认合并内置规则与用户自定义关键词", () => {
    const lines = [makeLine("编曲：钟兴民"), makeLine("海风轻拂着发梢")];

    const stripped = stripLyricMetadata(lines, {
      keywords: ["混音师"],
    });

    expect(stripped).toHaveLength(1);
    expect(stripped[0].words[0].word).toBe("海风轻拂着发梢");
  });

  it("useDefaultRules 为 false 时仅使用用户传入的关键词", () => {
    const lines = [makeLine("混音师"), makeLine("编曲"), makeLine("海风轻拂着发梢")];

    const stripped = stripLyricMetadata(lines, {
      useDefaultRules: false,
      keywords: ["混音师"],
    });

    expect(stripped).toHaveLength(2);
    expect(stripped[0].words[0].word).toBe("编曲");
    expect(stripped[1].words[0].word).toBe("海风轻拂着发梢");
  });

  it("无任何选项时默认启用内置规则", () => {
    const lines = [makeLine("词：方文山"), makeLine("海风轻拂着发梢")];

    const stripped = stripLyricMetadata(lines, {});
    expect(stripped).toHaveLength(1);
  });

  it("应剥离中英双语标签的元数据行", () => {
    const lines = [
      makeLine("作曲 Composer: 李洋 Yang Lee"),
      makeLine("母带制作 Mastering Engineer：宫奇Gon"),
      makeLine("出品 Produced by：HOYO-MiX"),
      makeLine("海风轻拂着发梢"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(1);
    expect(stripped[0].words[0].word).toBe("海风轻拂着发梢");
  });

  it("应剥离混音/母带等组合标签", () => {
    const lines = [
      makeLine("混音/母带 Mixing/Mastering Engineer：黄巍"),
      makeLine("第一句真正的歌词"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(1);
  });

  it("应保留声部标识行（裸标签与带内容均视为歌曲结构）", () => {
    const lines = [
      makeLine("合："),
      makeLine("男："),
      makeLine("女：在屋顶唱着你的歌"),
      makeLine("海风轻拂着发梢"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(4);
  });

  it("应剥离制作类与商务联系元数据行", () => {
    const lines = [
      makeLine("出品方：某某音乐"),
      makeLine("特别感谢：所有歌迷"),
      makeLine("业务联系：yunmusic_2013@163.com"),
      makeLine("海风轻拂着发梢"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(1);
  });

  it("应归一化兼容字形后再匹配关键词", () => {
    const lines = [makeLine("混⾳：TC"), makeLine("海风轻拂着发梢")];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(1);
  });

  it("应剥离借鉴词库的制作与乐器元数据行", () => {
    const lines = [
      makeLine("配器：陈致逸"),
      makeLine("指挥：李心草"),
      makeLine("唱片公司：太合麦田"),
      makeLine("马头琴：塔林图雅"),
      makeLine("未经授权，禁止转载"),
      makeLine("海风轻拂着发梢"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(1);
  });

  it("应支持自定义 keywords 与默认预归一化规则合并生效", () => {
    const lines = [makeLine("特殊协力：张三"), makeLine("词：李四"), makeLine("海风轻拂着发梢")];

    const stripped = stripLyricMetadata(lines, { keywords: ["特殊协力"] });
    expect(stripped).toHaveLength(1);
    expect(stripped[0].words[0].word).toBe("海风轻拂着发梢");
  });

  it("useDefaultRules 为 false 时应仅应用自定义规则", () => {
    const lines = [makeLine("词：李四"), makeLine("海风轻拂着发梢")];

    const stripped = stripLyricMetadata(lines, { useDefaultRules: false });
    expect(stripped).toHaveLength(2);
  });

  it("单词含首尾空白时行文本应先 trim 再匹配（锚定正则与空白行跳过依赖此行为）", () => {
    const anchored = stripLyricMetadata([makeLine(" 纯音乐，请欣赏 "), makeLine("歌词正文")]);
    expect(anchored).toHaveLength(1);
    expect(anchored[0].words[0].word).toBe("歌词正文");

    const blankSkipped = stripLyricMetadata([
      makeLine(" "),
      makeLine("作词：张三"),
      makeLine("歌词正文"),
    ]);
    expect(blankSkipped).toHaveLength(1);
  });

  it("应正确剥离以单字冒号制作职责开头的元数据行（词/曲/编/录/混/唱等）", () => {
    const lines = [
      makeLine("词：测试词作者"),
      makeLine("曲：测试曲作者"),
      makeLine("编：测试编曲人"),
      makeLine("唱：测试演唱者"),
      makeLine("男：微风轻轻吹过宁静的山谷"),
      makeLine("女：阳光洒落在清澈的溪水边"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(2);
    expect(stripped[0].words[0].word).toBe("男：微风轻轻吹过宁静的山谷");
    expect(stripped[1].words[0].word).toBe("女：阳光洒落在清澈的溪水边");
  });

  it("首行标题附属拆出的背景行与紧随的单字职责制作人行应被完整联动剔除", () => {
    const lines: LyricLine[] = [
      {
        startTime: 0,
        endTime: 520,
        words: [{ startTime: 0, endTime: 520, word: "晨曦微光 - 风铃乐队" }],
        translatedLyric: "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
      },
      {
        startTime: 340,
        endTime: 476,
        words: [{ startTime: 340, endTime: 476, word: "Wind Bell" }],
        translatedLyric: "",
        romanLyric: "",
        isBG: true,
        isDuet: false,
      },
      makeLine("词：测试词作者", 520),
      makeLine("曲：测试曲作者", 1050),
      makeLine("编：测试编曲人", 1580),
      makeLine("微风轻轻吹过宁静的山谷", 2111),
      makeLine("阳光洒落在清澈的溪水边", 7291),
    ];

    const stripped = stripLyricMetadata(lines, {
      matchMetadata: {
        title: "晨曦微光",
        artists: ["风铃乐队"],
      },
    });

    expect(stripped).toHaveLength(2);
    expect(stripped[0].words[0].word).toBe("微风轻轻吹过宁静的山谷");
    expect(stripped[1].words[0].word).toBe("阳光洒落在清澈的溪水边");
  });

  it("若任意主行被剔除或背景行孤立，附属背景行应联动剔除，而保留主行的背景行不受影响", () => {
    const lines: LyricLine[] = [
      { ...makeLine("孤立背景行"), isBG: true },
      makeLine("晨曦微光 - 风铃乐队"),
      { ...makeLine("Wind Bell"), isBG: true },
      makeLine("微风轻轻吹过宁静的山谷"),
      { ...makeLine("(啦啦啦)"), isBG: true },
      makeLine("出品：测试唱片公司"),
      { ...makeLine("(Records Studio)"), isBG: true },
    ];

    const stripped = stripLyricMetadata(lines, {
      matchMetadata: {
        title: "晨曦微光",
        artists: ["风铃乐队"],
      },
    });

    expect(stripped).toHaveLength(2);
    expect(stripped[0].words[0].word).toBe("微风轻轻吹过宁静的山谷");
    expect(stripped[1].words[0].word).toBe("(啦啦啦)");
    expect(stripped[1].isBG).toBe(true);
  });

  it("正文歌词中以单字职责字开头但无冒号的行不应被误杀（如唱、美、编等）", () => {
    const lines = [
      makeLine("唱，大声唱出心中的梦想"),
      makeLine("美！眼前的风景真的太美了"),
      makeLine("编织着未来的希望"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(3);
    expect(stripped[0].words[0].word).toBe("唱，大声唱出心中的梦想");
    expect(stripped[1].words[0].word).toBe("美！眼前的风景真的太美了");
    expect(stripped[2].words[0].word).toBe("编织着未来的希望");
  });

  it("应剥离无冒号分隔格式的制作信息行（作词-青石 / 编曲（林一））", () => {
    const lines = [
      makeLine("作词-青石"),
      makeLine("编曲（林一）"),
      makeLine("混音·木棉"),
      makeLine("微风轻轻吹过宁静的山谷"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(1);
    expect(stripped[0].words[0].word).toBe("微风轻轻吹过宁静的山谷");
  });

  it("无冒号回退匹配不应误杀以多字关键词开头的正文歌词", () => {
    const lines = [
      makeLine("编制着我们的未来"),
      makeLine("录音机里传来旧的歌"),
      makeLine("合唱团的孩子们在歌唱"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(3);
  });

  it("应剥离调校与调教等虚拟歌手制作职能行", () => {
    const lines = [
      makeLine("作词：COP"),
      makeLine("作曲：COP"),
      makeLine("调校：纳兰寻风"),
      makeLine("调教：某调教师"),
      makeLine("深夜里点亮微弱的光"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(1);
    expect(stripped[0].words[0].word).toBe("深夜里点亮微弱的光");
  });

  it("应剥离DJ音乐与TME AI生成的占位元数据行", () => {
    const lines = [
      makeLine("DJ音乐，请欣赏"),
      makeLine("本字幕由TME AI技术生成"),
      makeLine("这是正文第一句"),
      makeLine("这是正文第二句"),
      makeLine("本字幕由 TME AI 技术生成。"),
    ];

    const stripped = stripLyricMetadata(lines);
    expect(stripped).toHaveLength(2);
    expect(stripped[0].words[0].word).toBe("这是正文第一句");
    expect(stripped[1].words[0].word).toBe("这是正文第二句");
  });
});
