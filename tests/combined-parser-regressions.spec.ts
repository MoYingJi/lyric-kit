import { describe, expect, it } from "vitest";
import { pairTranslation, parseLRC, parseLyric, parseTTML } from "../src/parse";
import { toEnhancedLRC, toLRC } from "../src/serialize";
import type { LyricLine } from "../src/types";
import { createActiveLyricFinder, findActiveLyricIndices } from "../src/utils/sync";

const line = (word: string, isDuet = false, agentId?: string): LyricLine => ({
  startTime: 1000,
  endTime: 2000,
  words: [{ word, startTime: 1000, endTime: 2000 }],
  translatedLyric: "",
  romanLyric: "",
  isBG: false,
  isDuet,
  ...(agentId ? { agentId } : {}),
});

describe("优化分支与时间兼容修复的交叉回归", () => {
  it("同时开始的对唱歌词按歌手对齐外部翻译，输入顺序不影响归属", () => {
    const main = [line("主唱"), line("对唱", true)];
    pairTranslation(main, [line("对唱译文", true), line("主唱译文")], "translatedLyric");
    expect(main.map((item) => item.translatedLyric)).toEqual(["主唱译文", "对唱译文"]);
  });

  it("TTML 多个 agent 的翻译和罗马音优先匹配同 agent", () => {
    for (const field of ["translatedLyric", "romanLyric"] as const) {
      const main = [line("歌手甲", false, "singer-a"), line("歌手乙", false, "singer-b")];
      pairTranslation(
        main,
        [line("乙辅助", false, "singer-b"), line("甲辅助", false, "singer-a")],
        field,
      );
      expect(main.map((item) => item[field])).toEqual(["甲辅助", "乙辅助"]);
    }
  });

  it("双方明确标记不同歌手时不错误回退，未标记的一方仍兼容时间匹配", () => {
    const distinct = [line("歌手甲", false, "singer-a")];
    pairTranslation(distinct, [line("歌手乙译文", false, "singer-b")], "translatedLyric");
    expect(distinct[0].translatedLyric).toBe("");
    for (const mainHasAgent of [false, true]) {
      const main = [line("正文", true, mainHasAgent ? "singer-a" : undefined)];
      const trans = [line("译文", true, mainHasAgent ? undefined : "singer-a")];
      pairTranslation(main, trans, "translatedLyric");
      expect(main[0].translatedLyric).toBe("译文");
    }
  });

  it("多歌手密集重复时间戳与独立的线性匹配参考结果一致", () => {
    let seed = 338;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    for (let run = 0; run < 100; run++) {
      const create = (word: string): LyricLine => {
        const item = line(word, (random() & 2) !== 0, `singer-${random() % 3}`);
        item.isBG = (random() & 2) !== 0;
        item.startTime = (random() % 30) * 50;
        return item;
      };
      const main = Array.from({ length: 40 }, (_, index) => create(`主${index}`));
      const trans = Array.from({ length: 35 }, (_, index) => create(`译${index}`));
      const beforeTrans = structuredClone(trans);
      const expected = structuredClone(main);
      const used = new Set<number>();
      const pending: LyricLine[] = [];
      const compatible = (target: LyricLine, item: LyricLine): boolean =>
        target.agentId === item.agentId && target.isBG === item.isBG;
      const assign = (index: number, item: LyricLine): void => {
        used.add(index);
        expected[index].translatedLyric = item.words[0].word;
      };
      for (const item of [...trans].sort((a, b) => a.startTime - b.startTime)) {
        const index = expected.findIndex(
          (target, candidate) =>
            !used.has(candidate) && compatible(target, item) && target.startTime === item.startTime,
        );
        if (index >= 0) assign(index, item);
        else pending.push(item);
      }
      for (const item of pending) {
        const candidates = expected
          .map((target, index) => ({
            target,
            index,
            distance: Math.abs(target.startTime - item.startTime),
          }))
          .filter(
            ({ target, index, distance }) =>
              !used.has(index) && compatible(target, item) && distance <= 300,
          )
          .sort(
            (a, b) =>
              a.distance - b.distance ||
              a.target.startTime - b.target.startTime ||
              a.index - b.index,
          );
        if (candidates[0]) assign(candidates[0].index, item);
      }
      pairTranslation(main, trans, "translatedLyric");
      expect(main).toEqual(expected);
      expect(trans).toEqual(beforeTrans);
    }
  });

  it("外部整秒 LRC 未标注歌手时仍可对齐对唱歌词", () => {
    const { lines } = parseLyric({
      content: "[5]对唱(1000,1000)",
      translation: "[00:01]译文",
      romaji: "[00:01]roman",
    });
    expect(lines[0]).toMatchObject({ isDuet: true, translatedLyric: "译文", romanLyric: "roman" });
  });

  it("外部 TTML 歌手出现顺序改变时，翻译按 agent 对齐而非各文件的左右声部", () => {
    const xml = (body: string) => `<tt xmlns="http://www.w3.org/ns/ttml"
      xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><body><div>${body}</div></body></tt>`;
    const paragraph = (agent: string, text: string) =>
      `<p begin="1s" end="2s" ttm:agent="${agent}">${text}</p>`;
    const { lines } = parseLyric({
      content: xml(paragraph("v1", "甲") + paragraph("v2", "乙")),
      translation: xml(paragraph("v2", "乙译") + paragraph("v1", "甲译")),
    });
    expect(lines.map((item) => [item.agentId, item.isDuet, item.translatedLyric])).toEqual([
      ["v1", false, "甲译"],
      ["v2", true, "乙译"],
    ]);
  });

  it.each([
    ['begin="1s"', '<span begin="2s" end="3s">正文</span>', 1000, 3000],
    ['end="4s"', '<span begin="2s" end="3s">正文</span>', 2000, 4000],
    ['begin="2s" end="3s"', '<span begin="1s" end="4s">正文</span>', 1000, 4000],
    ['begin="2s" end="3s"', '<span ttm:role="x-bg" begin="1s" end="4s">(背景)</span>', 1000, 4000],
    [
      'begin="1s" end="5s"',
      '<span ttm:role="x-bg" begin="2s" end="4s"><span begin="1s" end="5s">(背景)</span></span>',
      1000,
      5000,
    ],
  ])("TTML 行时间按 AMLL 规则结合逐字与背景范围：%s", (attrs, content, startTime, endTime) => {
    const { lines } = parseTTML(`<tt xmlns="http://www.w3.org/ns/ttml"
      xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><body><div>
      <p ${attrs}>${content}</p></div></body></tt>`);
    expect(lines.find((item) => !item.isBG)).toMatchObject({ startTime, endTime });
    if (lines.some((item) => item.isBG)) {
      expect(lines.find((item) => item.isBG)).toMatchObject({
        startTime: 1000,
        endTime: Number(endTime),
      });
    }
  });

  it.each(["qrc", "krc"] as const)("%s 内嵌假名已解析时不重复叠加外部假名或偏移", (format) => {
    const body = format === "qrc" ? "[1000,500]怪(1000,500)" : "[1000,500]<0,500>怪";
    const content = `[kana:1か(1000,250)い(1250,250)]\n[offset:500]\n${body}`;
    const options = { applyOffset: true, cleanKangxi: true };
    const inline = parseLyric({ content, format }, options);
    const external = parseLyric(
      { content, format, kana: "[kana:1べ(1000,250)つ(1250,250)]" },
      options,
    );
    expect(external).toEqual(inline);
    expect(external.lines[0].words[0].ruby).toHaveLength(2);
  });

  it("标准 LRC 往返模式保留毫秒起点，默认导出保留原有厘秒格式", () => {
    const original = line("正文");
    original.startTime = original.words[0].startTime = 1001;
    const restored = parseLRC(toLRC([original], { roundTrip: true }));
    expect(restored.lines[0].startTime).toBe(1001);
    expect(toLRC([original])).toBe("[00:01.00]正文");
  });

  it.each([false, true])("增强 LRC 往返模式保留 isBG=%s 的毫秒词间空隙", (isBG) => {
    const original: LyricLine = {
      ...line(""),
      startTime: 1001,
      endTime: 2009,
      isBG,
      words: [
        { word: "Hello ", startTime: 1001, endTime: 1307 },
        { word: "World", startTime: 1555, endTime: 2009 },
      ],
      romanLyric: "hello world",
    };
    expect(parseLRC(toEnhancedLRC([original], { roundTrip: true })).lines).toEqual([original]);
  });

  it("负偏移造成时间戳合并后，翻译仍按原始行对齐且不重复偏移", () => {
    const { lines, metadata } = parseLyric(
      {
        content: "[offset:-1500]\n[00:01]原词甲\n[00:02]原词乙",
        translation: "[offset:-1500]\n[00:01]译文甲\n[00:02]译文乙",
      },
      { applyOffset: true },
    );
    expect(lines.map((item) => [item.startTime, item.translatedLyric])).toEqual([
      [0, "译文甲"],
      [500, "译文乙"],
    ]);
    expect(metadata).toEqual({});
  });

  it("时间索引在多次偏移、时间排序和歌词替换后重建仍匹配线性查询", () => {
    const content = "[00:01]<00:01>你<00:02>好<00:03>\n[00:02](回声)\n[00:05]再见";
    for (const offset of [-2000, 0, 500]) {
      const { lines } = parseLyric(`[offset:${offset}]\n${content}`, { applyOffset: true });
      const find = createActiveLyricFinder(lines);
      for (let time = 0; time < 15000; time += 17) {
        expect(find(time)).toEqual(findActiveLyricIndices(lines, time));
      }
    }
  });
});
