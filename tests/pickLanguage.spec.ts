import { describe, expect, it } from "vitest";
import { pickLangIndex } from "../src/utils/pickLanguage";

describe("pickLangIndex", () => {
  it("传入 zh-CN 时应优先匹配 zh-Hans", () => {
    const langs = ["ja", "zh-Hant", "zh-Hans", "en"];
    const preferred = "zh-CN";
    expect(pickLangIndex(langs, preferred)).toBe(2);
  });
});
