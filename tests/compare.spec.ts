import { describe, expect, it } from "vitest";
import { applyTimestampOffset, compareLyrics, hasWordTiming } from "../src/index";
import type { LyricLine, LyricWord } from "../src/types";

const LINE_STEP_MS = 4000;
const LINE_LENGTH_MS = 3500;

const BASE_TEXTS = [
  "清晨的风吹过窗台",
  "你的影子落在街角",
  "我把心事写给云朵",
  "等一场迟来的雨水",
  "旧车票还夹在书里",
  "那年夏天没有说完",
  "灯火慢慢爬上山坡",
  "我们沿着河岸走远",
  "时间带走许多名字",
  "只留下一段旋律",
  "如果明天还能遇见",
  "请你再唱这一首歌",
];

const UNRELATED_TEXTS = [
  "海面翻起银色波浪",
  "水手拉紧破旧缆绳",
  "远方灯塔忽明忽暗",
  "渔船驶入深夜航线",
  "星辰坠进漆黑潮汐",
  "甲板堆满咸涩盐粒",
  "老船长抽着烟斗笑",
  "港口钟声敲响三下",
  "鸥鸟掠过生锈桅杆",
  "货舱装满南方香料",
  "归期写在褪色海图",
  "明早启航驶向群岛",
];

const makeLine = (text: string, startTime: number, overrides: Partial<LyricLine> = {}) => ({
  startTime,
  endTime: startTime + LINE_LENGTH_MS,
  words: [{ startTime, endTime: startTime + LINE_LENGTH_MS, word: text }],
  translatedLyric: "",
  romanLyric: "",
  isBG: false,
  isDuet: false,
  ...overrides,
});

const makeLines = (texts: readonly string[], offsetMs = 0): LyricLine[] =>
  texts.map((text, index) => makeLine(text, index * LINE_STEP_MS + offsetMs));

describe("compareLyrics 正文比较", () => {
  it("忽略标点、大小写、全角与语气词后判定为相同", () => {
    const candidate = makeLines(BASE_TEXTS.map((text) => `啊，${text}！Oh yeah`));

    const result = compareLyrics(makeLines(BASE_TEXTS), candidate);

    expect(result.verdict).toBe("same");
    expect(result.baselineCoverage).toBe(1);
    expect(result.candidateCoverage).toBe(1);
  });

  it("全角拉丁文字按半角比较", () => {
    const baselineTexts = BASE_TEXTS.map((text) => `${text} HELLO`);
    const candidateTexts = BASE_TEXTS.map((text) => `${text} ｈｅｌｌｏ`);

    const result = compareLyrics(makeLines(baselineTexts), makeLines(candidateTexts));

    expect(result.baselineCoverage).toBe(1);
  });

  it("正文无关的歌词判定为不同", () => {
    const result = compareLyrics(makeLines(BASE_TEXTS), makeLines(UNRELATED_TEXTS));

    expect(result.verdict).toBe("different");
    expect(result.baselineCoverage).toBeLessThan(0.3);
  });

  it("拉丁文字按词比较，字母相近的不同句子不算匹配", () => {
    const baseline = makeLines(
      Array.from({ length: 12 }, (_, index) => `dancing under silver moon tonight ${index}`),
    );
    const candidate = makeLines(
      Array.from({ length: 12 }, (_, index) => `singing over golden sun forever ${index}`),
    );

    const result = compareLyrics(baseline, candidate);

    expect(result.verdict).toBe("different");
  });

  it("候选缺失大段内容时判定为不同", () => {
    const candidate = makeLines(BASE_TEXTS.slice(0, 6));

    const result = compareLyrics(makeLines(BASE_TEXTS), candidate);

    expect(result.verdict).toBe("different");
    expect(result.baselineCoverage).toBeCloseTo(48 / 95);
    expect(result.candidateCoverage).toBe(1);
  });

  it("候选少量缺失时仍判定为相同", () => {
    const candidate = makeLines(BASE_TEXTS.slice(0, 9));

    const result = compareLyrics(makeLines(BASE_TEXTS), candidate);

    expect(result.verdict).toBe("same");
    expect(result.baselineCoverage).toBeCloseTo(72 / 95);
  });

  it("基准只有部分段落时仍可判定候选相同", () => {
    const result = compareLyrics(makeLines(BASE_TEXTS.slice(0, 6)), makeLines(BASE_TEXTS));

    expect(result.verdict).toBe("same");
    expect(result.baselineCoverage).toBe(1);
    expect(result.candidateCoverage).toBeCloseTo(48 / 95);
  });

  it("基准过短的短文本被长候选包含时不算相同", () => {
    const baseline = makeLines(BASE_TEXTS.slice(0, 2));

    const result = compareLyrics(baseline, makeLines([...BASE_TEXTS, ...UNRELATED_TEXTS]));

    expect(result.verdict).toBe("different");
  });
});

describe("compareLyrics 清洗", () => {
  it("排除元数据行", () => {
    const candidate = [
      makeLine("作词：某人", 0),
      makeLine("作曲：某人", 500),
      ...makeLines(BASE_TEXTS, 1000),
    ];

    const result = compareLyrics(makeLines(BASE_TEXTS, 1000), candidate);

    expect(result.candidateCoverage).toBe(1);
    expect(result.verdict).toBe("same");
  });

  it("传入 matchMetadata 时排除歌名歌手行", () => {
    const candidate = [makeLine("远行的信 - 某歌手", 0), ...makeLines(BASE_TEXTS, 1000)];

    const result = compareLyrics(makeLines(BASE_TEXTS, 1000), candidate, {
      matchMetadata: { title: "远行的信", artists: ["某歌手"] },
    });

    expect(result.candidateCoverage).toBe(1);
  });

  it("排除背景人声行", () => {
    const candidate = makeLines(BASE_TEXTS).flatMap((line, index) => [
      line,
      makeLine(UNRELATED_TEXTS[index], line.startTime, { isBG: true }),
    ]);

    const result = compareLyrics(makeLines(BASE_TEXTS), candidate);

    expect(result.candidateCoverage).toBe(1);
    expect(result.verdict).toBe("same");
  });
});

describe("compareLyrics 时间轴", () => {
  it("时间一致时偏移为 0", () => {
    const result = compareLyrics(makeLines(BASE_TEXTS), makeLines(BASE_TEXTS));

    expect(result.verdict).toBe("same");
    expect(result.offsetMs).toBe(0);
    expect(result.offsetSpreadMs).toBe(0);
  });

  it("整体偏移较大时判定为 shifted 并给出偏移量", () => {
    const result = compareLyrics(makeLines(BASE_TEXTS), makeLines(BASE_TEXTS, 3000));

    expect(result.verdict).toBe("shifted");
    expect(result.offsetMs).toBe(3000);
    expect(result.offsetSpreadMs).toBe(0);
  });

  it("候选早于基准时偏移为负", () => {
    const result = compareLyrics(makeLines(BASE_TEXTS, 3000), makeLines(BASE_TEXTS));

    expect(result.verdict).toBe("shifted");
    expect(result.offsetMs).toBe(-3000);
  });

  it("用偏移量取反平移候选后与基准一致", () => {
    const candidate = makeLines(BASE_TEXTS, 3000);
    const { offsetMs } = compareLyrics(makeLines(BASE_TEXTS), candidate);

    applyTimestampOffset(candidate, -offsetMs);

    const result = compareLyrics(makeLines(BASE_TEXTS), candidate);
    expect(result.verdict).toBe("same");
    expect(result.offsetMs).toBe(0);
  });

  it("小偏移仍判定为 same，但保留偏移量", () => {
    const result = compareLyrics(makeLines(BASE_TEXTS), makeLines(BASE_TEXTS, 300));

    expect(result.verdict).toBe("same");
    expect(result.offsetMs).toBe(300);
  });

  it("部分行时间相同但后段错位时判定为不同版本", () => {
    const candidate = makeLines(BASE_TEXTS);
    for (const line of candidate.slice(8)) {
      line.startTime += 30000;
      line.endTime += 30000;
    }

    const result = compareLyrics(makeLines(BASE_TEXTS), candidate);

    expect(result.verdict).toBe("different");
    expect(result.offsetMs).toBe(0);
    expect(result.offsetSpreadMs).toBe(30000);
  });

  it("行首时间有数秒内的抖动时仍判定为相同", () => {
    const jitters = [-1250, -1250, -1250, 0, 0, 0, 0, 0, 0, 1250, 1250, 1250];
    const candidate = BASE_TEXTS.map((text, index) =>
      makeLine(text, index * LINE_STEP_MS + jitters[index] + 2000),
    );
    const baseline = makeLines(BASE_TEXTS, 2000);

    const result = compareLyrics(baseline, candidate);

    expect(result.verdict).toBe("same");
    expect(result.offsetSpreadMs).toBe(1250);
  });

  it("少数行时间错位时仍判定为相同", () => {
    const candidate = makeLines(BASE_TEXTS);
    for (const index of [2, 5, 8]) {
      candidate[index].startTime += 6000;
      candidate[index].endTime += 6000;
    }

    const result = compareLyrics(makeLines(BASE_TEXTS), candidate);

    expect(result.verdict).toBe("same");
    expect(result.offsetMs).toBe(0);
  });

  it("时间差逐渐增大时不判定为可平移", () => {
    const candidate = BASE_TEXTS.map((text, index) =>
      makeLine(text, index * LINE_STEP_MS + 200 + index * 290),
    );

    const result = compareLyrics(makeLines(BASE_TEXTS), candidate);

    expect(result.verdict).toBe("different");
  });

  it("个别行错位不影响判定", () => {
    const candidate = makeLines(BASE_TEXTS);
    candidate[5].startTime += 30000;

    const result = compareLyrics(makeLines(BASE_TEXTS), candidate);

    expect(result.verdict).toBe("same");
    expect(result.offsetMs).toBe(0);
  });

  it("副歌重复时不影响偏移计算", () => {
    const chorusTexts = [
      ...BASE_TEXTS.slice(0, 4),
      ...BASE_TEXTS.slice(0, 4),
      ...BASE_TEXTS.slice(0, 4),
    ];

    const result = compareLyrics(makeLines(chorusTexts), makeLines(chorusTexts, 3000));

    expect(result.verdict).toBe("shifted");
    expect(result.offsetMs).toBe(3000);
    expect(result.offsetSpreadMs).toBe(0);
  });

  it("候选把一行拆成两行时仍能计算偏移", () => {
    const candidate = BASE_TEXTS.flatMap((text, index) => {
      const startTime = index * LINE_STEP_MS + 2000;
      return [
        makeLine(text.slice(0, 4), startTime),
        makeLine(text.slice(4), startTime + LINE_STEP_MS / 2),
      ];
    });

    const result = compareLyrics(makeLines(BASE_TEXTS), candidate);

    expect(result.verdict).toBe("shifted");
    expect(result.offsetMs).toBe(2000);
    expect(result.baselineCoverage).toBe(1);
  });
});

describe("compareLyrics 无法判断", () => {
  it("基准内容太少时返回 unknown", () => {
    const result = compareLyrics(makeLines(["短短一句"]), makeLines(BASE_TEXTS));

    expect(result.verdict).toBe("unknown");
  });

  it("基准为空时返回 unknown", () => {
    expect(compareLyrics([], makeLines(BASE_TEXTS)).verdict).toBe("unknown");
  });

  it("正文相同但没有足够的行首对齐点时返回 unknown", () => {
    const joined = BASE_TEXTS.join("");
    const candidateTexts = BASE_TEXTS.map((text, index) => {
      const start = BASE_TEXTS.slice(0, index).join("").length + (index === 0 ? 0 : 1);
      return joined.slice(start, start + text.length);
    });

    const result = compareLyrics(makeLines(BASE_TEXTS), makeLines(candidateTexts));

    expect(result.verdict).toBe("unknown");
    expect(result.baselineCoverage).toBeGreaterThan(0.9);
  });

  it("歌词超出比较上限时返回 unknown", () => {
    const hugeTexts = BASE_TEXTS.map((text) => text.repeat(60));

    const result = compareLyrics(makeLines(hugeTexts), makeLines(hugeTexts));

    expect(result.verdict).toBe("unknown");
  });
});

describe("compareLyrics 输入", () => {
  it("不修改传入的歌词行", () => {
    const baseline = makeLines(BASE_TEXTS);
    const candidate = makeLines(BASE_TEXTS, 3000);
    const baselineSnapshot = structuredClone(baseline);
    const candidateSnapshot = structuredClone(candidate);

    compareLyrics(baseline, candidate);

    expect(baseline).toEqual(baselineSnapshot);
    expect(candidate).toEqual(candidateSnapshot);
  });
});

describe("hasWordTiming", () => {
  const makeWord = (word: string, startTime: number, endTime: number): LyricWord => ({
    word,
    startTime,
    endTime,
  });

  it("多个字有各自时间时返回 true", () => {
    const line = makeLine("", 0, { words: [makeWord("清", 0, 200), makeWord("晨", 200, 400)] });

    expect(hasWordTiming([line])).toBe(true);
  });

  it("每行只有一个片段时返回 false", () => {
    expect(hasWordTiming(makeLines(BASE_TEXTS))).toBe(false);
  });

  it("多个片段共用同一起始时间时返回 false", () => {
    const line = makeLine("", 0, { words: [makeWord("清", 0, 400), makeWord("晨", 0, 400)] });

    expect(hasWordTiming([line])).toBe(false);
  });

  it("多个片段没有时长时返回 false", () => {
    const line = makeLine("", 0, { words: [makeWord("清", 0, 0), makeWord("晨", 100, 100)] });

    expect(hasWordTiming([line])).toBe(false);
  });

  it("空数组返回 false", () => {
    expect(hasWordTiming([])).toBe(false);
  });
});

describe("applyTimestampOffset 导出", () => {
  it("平移行、逐字和注音时间", () => {
    const line = makeLine("", 1000, {
      words: [
        {
          word: "君",
          startTime: 1000,
          endTime: 1500,
          ruby: [{ word: "きみ", startTime: 1000, endTime: 1500 }],
        },
      ],
    });

    applyTimestampOffset([line], -400);

    expect(line.startTime).toBe(600);
    expect(line.words[0].startTime).toBe(600);
    expect(line.words[0].ruby?.[0].startTime).toBe(600);
  });
});
