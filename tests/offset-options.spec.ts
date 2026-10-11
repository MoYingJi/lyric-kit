import { describe, expect, it } from "vitest";
import { parseKRC, parseLRC, parseLyS, parseQRC, parseYRC } from "../src/parse";

const formats = [
  { name: "LRC", parse: parseLRC, content: "[00:01.00]<00:01.00>词<00:02.00>" },
  { name: "QRC", parse: parseQRC, content: "[1000,1000]词(1000,1000)" },
  { name: "KRC", parse: parseKRC, content: "[1000,1000]<0,1000>词" },
  { name: "YRC", parse: parseYRC, content: "[1000,1000](1000,1000,0)词" },
  { name: "LyS", parse: parseLyS, content: "[0]词(1000,1000)" },
];

describe.each(formats)("$name offset 选项独立性", ({ parse, content }) => {
  it.each([-2000, -500, 500])("offset=%i 不依赖元数据输出开关", (offset) => {
    for (const applyOffset of [false, true]) {
      for (const extractMetadata of [false, true]) {
        const result = parse(`[ti:标题]\n[OFFSET:${offset}]\n${content}`, {
          applyOffset,
          extractMetadata,
        });
        const expectedStart = Math.max(0, 1000 + (applyOffset ? offset : 0));
        const expectedEnd = Math.max(0, 2000 + (applyOffset ? offset : 0));
        expect(result.lines[0].startTime).toBe(expectedStart);
        expect(result.lines[0].endTime).toBe(expectedEnd);
        expect(result.lines[0].words[0]).toMatchObject({
          startTime: expectedStart,
          endTime: expectedEnd,
        });
        if (extractMetadata) expect(result.metadata.offset).toBe(offset);
        else expect(result.metadata).toEqual({});
      }
    }
  });

  it("无效 offset 不覆盖之前有效值", () => {
    expect(
      parse(`[offset:500]\n[offset:invalid]\n${content}`, { applyOffset: true }).lines[0].startTime,
    ).toBe(1500);
    expect(parse(`[offset:invalid]\n${content}`, { applyOffset: true }).lines[0].startTime).toBe(
      1000,
    );
  });
});
