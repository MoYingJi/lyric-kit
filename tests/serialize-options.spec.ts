import { describe, expect, it } from "vitest";
import { parseLyric } from "../src/parse";
import { serializeLyric } from "../src/serialize";
import type { ParseOptions, SerializeOptions } from "../src/types";

const content = "[offset:500]\n[00:01.00]⾔";

describe("统一导出入口的解析配置", () => {
  it("新嵌套参数与原有扁平参数输出一致", () => {
    const legacy: ParseOptions = { applyOffset: true, cleanKangxi: true };
    const options: SerializeOptions = { parse: legacy };
    expect(serializeLyric(content, "lrc", options)).toBe("[00:01.50]言");
    expect(serializeLyric(content, "lrc", legacy)).toBe(serializeLyric(content, "lrc", options));
    expect(serializeLyric(content, undefined, { applyOffset: true })).toBe("[00:01.50]⾔");
    expect(serializeLyric(content)).toBe("[00:01.00]⾔");
  });

  it("解析与导出选项可同时生效并保持配置对象不变", () => {
    const options: SerializeOptions = { roundTrip: true, parse: { applyOffset: true } };
    const before = structuredClone(options);
    const source = "[offset:500]\n[1000,1000]词(1000,1000)";
    expect(serializeLyric({ content: source, format: "qrc" }, "elrc", options)).toBe(
      "[00:01.500]<00:01.500>词<00:02.500>",
    );
    expect(options).toEqual(before);
  });

  it("显式关闭元数据提取并保留旧入口默认提取行为", () => {
    const source = "[ti:标题]\n[00:01.00]歌词";
    expect(serializeLyric(source, "ttml")).toContain("标题");
    expect(serializeLyric(source, "ttml", { parse: { extractMetadata: false } })).not.toContain(
      "标题",
    );
    expect(serializeLyric(source, "ttml", { extractMetadata: false })).not.toContain("标题");
  });

  it("已解析的数组和结果不再次应用解析选项", () => {
    const result = parseLyric(content, { extractMetadata: true });
    const original = structuredClone(result);
    const options: SerializeOptions = { parse: { applyOffset: true, cleanKangxi: true } };
    expect(serializeLyric(result, "lrc", options)).toBe("[00:01.00]⾔");
    expect(serializeLyric(result.lines, "lrc", options)).toBe("[00:01.00]⾔");
    expect(result).toEqual(original);
  });

  it("新旧配置混用时嵌套解析配置优先", () => {
    const options = { roundTrip: true, applyOffset: true, parse: { applyOffset: false } };
    expect(serializeLyric(content, "lrc", options)).toBe("[00:01.000]⾔");
  });
});
