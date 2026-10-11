import { describe, expect, it } from "vitest";
import { parseLyric } from "../src/parse";

describe("外部 kana 时间偏移", () => {
  it.each([
    { format: "qrc" as const, content: "[1000,500]怪(1000,500)" },
    { format: "krc" as const, content: "[1000,500]<0,500>怪" },
  ])("$format 内联与外部带时间戳 kana 一致", ({ format, content }) => {
    const kana = "[kana:1か(1000,250)い(1250,250)]";
    for (const offset of [-1200, -500, 500]) {
      for (const extractMetadata of [false, true]) {
        for (const applyOffset of [false, true]) {
          const source = `[offset:${offset}]\n${content}`;
          const options = { format, extractMetadata, applyOffset, cleanKangxi: true };
          const inline = parseLyric(`${kana}\n${source}`, options);
          const external = parseLyric({ content: source, kana }, options);
          expect(external.lines).toEqual(inline.lines);
          if (!extractMetadata) expect(external.metadata).toEqual({});
          else expect(external.metadata.offset).toBe(offset);
        }
      }
    }
  });

  it("无时间戳 kana 使用已偏移词时间，不重复偏移", () => {
    const result = parseLyric(
      { content: "[offset:500]\n[1000,500]怪(1000,500)", kana: "[kana:1かい]" },
      { applyOffset: true },
    );
    expect(result.lines[0].words[0].ruby).toEqual([
      { word: "かい", startTime: 1500, endTime: 2000 },
    ]);
  });
});
