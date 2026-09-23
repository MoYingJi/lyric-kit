import { describe, expect, it } from "vitest";
import { defaultAuthors, defaultKeywords, defaultRegexes } from "../src/clean/excludeRules";

/** 与 stripper 内 normalizeKw 保持一致的归一化 */
const normalizeKw = (str: string): string =>
  str.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

describe("excludeRules", () => {
  it("关键词不应有字面重复", () => {
    const seen = new Set<string>();
    const dups: string[] = [];
    for (const kw of defaultKeywords) {
      if (seen.has(kw)) dups.push(kw);
      seen.add(kw);
    }
    expect(dups).toEqual([]);
  });

  it("关键词归一化后不应重复（匹配时等价，纯属冗余）", () => {
    const seen = new Map<string, string>();
    const dups: string[] = [];
    for (const kw of defaultKeywords) {
      const norm = normalizeKw(kw);
      if (seen.has(norm)) dups.push(`${kw} ~ ${seen.get(norm)}`);
      else seen.set(norm, kw);
    }
    expect(dups).toEqual([]);
  });

  it("正则不应有字面重复", () => {
    expect(new Set(defaultRegexes).size).toBe(defaultRegexes.length);
  });

  it("正则都应可编译", () => {
    for (const pattern of defaultRegexes) {
      expect(() => new RegExp(pattern, "i")).not.toThrow();
    }
  });

  it("制作者排除关键词不应有重复且应包含核心项", () => {
    expect(new Set(defaultAuthors).size).toBe(defaultAuthors.length);
    expect(defaultAuthors).toContain("QQ音乐动态歌词");
    expect(defaultAuthors).toContain("krc转qrc工具");
    expect(defaultAuthors).toContain("AI智能字幕");
    expect(defaultAuthors).toContain("AI生成");
  });
});
