import { describe, expect, it } from "vitest";
import { extractLyricAuthors } from "../src/clean/author";
import type { LyricLine, LyricMetadata } from "../src/types";
import { applyLrcMetaTag } from "../src/utils/meta";
import { getWordSweepProgress } from "../src/utils/sweep";
import { pickAdvanceOnEndIndex, pickPrimaryIndex } from "../src/utils/sync";
import { getLineText } from "../src/utils/text";
import { transformLyricText } from "../src/utils/transform";

const makeLines = (rows: [number, number, string][]): LyricLine[] =>
  rows.map(([start, end, word]) => ({
    startTime: start,
    endTime: end,
    words: [{ startTime: start, endTime: end, word }],
    translatedLyric: "",
    romanLyric: "",
    isBG: false,
    isDuet: false,
  }));

describe("extractLyricAuthors", () => {
  it("ttml 优先返回 ttmlAuthorGithubLogin", () => {
    const xml = `<tt><head><metadata><amll:meta key="ttmlAuthorGithub" value="10001" /><amll:meta key="ttmlAuthorGithubLogin" value="user-a" /></metadata></head></tt>`;
    expect(extractLyricAuthors(xml, "ttml")).toEqual(["user-a"]);
  });

  it("ttml 无 login 时从 ttmlAuthorGithub 链接末段取用户名", () => {
    const xml = `<tt><head><metadata><amll:meta key="ttmlAuthorGithub" value="https://github.com/user-b" /></metadata></head></tt>`;
    expect(extractLyricAuthors(xml, "ttml")).toEqual(["user-b"]);
  });

  it("lrc 提取 [by:] 标签（不区分大小写）", () => {
    expect(extractLyricAuthors("[BY:lyricist]\n[00:01.00]词", "lrc")).toEqual(["lyricist"]);
  });

  it("无匹配时返回空数组且不抛错", () => {
    expect(extractLyricAuthors("[00:01.00]词", "lrc")).toEqual([]);
    expect(extractLyricAuthors("", "ttml")).toEqual([]);
    expect(extractLyricAuthors("任意", "qrc")).toEqual([]);
  });
});

describe("applyLrcMetaTag", () => {
  it("未知标签应写入 rawProperties（同 key 重复时后者覆盖）", () => {
    const metadata: LyricMetadata = {};
    applyLrcMetaTag(metadata, "Custom", "值1");
    applyLrcMetaTag(metadata, "custom", "值2");
    expect(metadata.rawProperties?.custom).toEqual(["值2"]);
  });

  it("空值标签应被忽略", () => {
    const metadata: LyricMetadata = {};
    applyLrcMetaTag(metadata, "ti", "  ");
    applyLrcMetaTag(metadata, "offset", "abc");
    expect(metadata.title).toBeUndefined();
    expect(metadata.offset).toBeUndefined();
  });
});

describe("transformLyricText", () => {
  it("应转换主词/注音/翻译并保持行结构（深拷贝不污染原对象）", async () => {
    const lines: LyricLine[] = [
      {
        ...makeLines([[0, 1000, "原"]])[0],
        translatedLyric: "trans",
        words: [
          {
            startTime: 0,
            endTime: 1000,
            word: "词",
            ruby: [{ startTime: 0, endTime: 500, word: "假名" }],
          },
        ],
      },
    ];
    const out = await transformLyricText(lines, (texts) => texts.map((t) => `${t}!`));
    expect(out[0].words[0].word).toBe("词!");
    expect(out[0].words[0].ruby?.[0].word).toBe("假名!");
    expect(out[0].translatedLyric).toBe("trans!");
    // 原对象不被污染
    expect(lines[0].words[0].word).toBe("词");
    expect(lines[0].translatedLyric).toBe("trans");
  });

  it("空数组与异步 transformer 应正确处理", async () => {
    expect(await transformLyricText([], (t) => t)).toEqual([]);
    const out = await transformLyricText(makeLines([[0, 1000, "词"]]), async (texts) =>
      texts.map((t) => t.toUpperCase()),
    );
    expect(out[0].words[0].word).toBe("词");
  });
});

describe("getWordSweepProgress 边界", () => {
  it("零时长单词不应除零（wordDuration 回退为 1ms）", () => {
    const p = getWordSweepProgress({ startTime: 500, endTime: 500 }, 0, 650);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThanOrEqual(1);
    expect(getWordSweepProgress({ startTime: 500, endTime: 500 }, 0, 100)).toBe(0);
  });

  it("preRoll 不应越过行起点，进度钳制在 [0,1]", () => {
    const lineStart = 1000;
    const word = { startTime: 1100, endTime: 2000 };
    expect(getWordSweepProgress(word, lineStart, 900)).toBe(0);
    expect(getWordSweepProgress(word, lineStart, 5000)).toBe(1);
    // preRoll = min(80, 900*0.3)=80 → adjustedStart=1020，但行起点 1000 < 1020
    expect(getWordSweepProgress(word, lineStart, 1030)).toBeGreaterThan(0);
  });
});

describe("pickAdvanceOnEndIndex / pickPrimaryIndex", () => {
  const lines = makeLines([
    [1000, 3000, "一"],
    [2500, 4000, "二"],
    [5000, 8000, "三"],
  ]);

  it("pickAdvanceOnEndIndex 当前行结束后应推进到下一行", () => {
    expect(pickAdvanceOnEndIndex(lines, 2000)).toBe(0);
    expect(pickAdvanceOnEndIndex(lines, 3500)).toBe(1);
    expect(pickAdvanceOnEndIndex(lines, 9000)).toBe(2);
    expect(pickAdvanceOnEndIndex(lines, 500)).toBe(-1);
  });

  it("pickPrimaryIndex 首行前序应显示首行，行间空隙应推进", () => {
    expect(pickPrimaryIndex(lines, 500)).toBe(0);
    expect(pickPrimaryIndex(lines, 1500)).toBe(0);
    expect(pickPrimaryIndex(lines, 4200)).toBe(2);
  });
});

describe("getLineText", () => {
  it("应原生拼接 word 并默认执行 trim", () => {
    const words = [
      { startTime: 0, endTime: 100, word: "Hello " },
      { startTime: 100, endTime: 200, word: "World" },
    ];
    expect(getLineText(words)).toBe("Hello World");
  });

  it("末尾即使带空格也会在整行尾部安全修剪 trim", () => {
    const words = [
      { startTime: 0, endTime: 100, word: "A " },
      { startTime: 100, endTime: 200, word: "B " },
    ];
    expect(getLineText(words)).toBe("A B");
  });

  it("空值与空数组安全回退为空字符串", () => {
    expect(getLineText(null)).toBe("");
    expect(getLineText([])).toBe("");
    const emptyLine: LyricLine = {
      startTime: 0,
      endTime: 0,
      words: [],
      translatedLyric: "",
      romanLyric: "",
      isBG: false,
      isDuet: false,
    };
    expect(getLineText(emptyLine)).toBe("");
  });
});
