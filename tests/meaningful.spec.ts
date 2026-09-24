import { describe, expect, it } from "vitest";
import { isMeaningfulTranslation } from "../src/clean/meaningful";
import { parseLyric } from "../src/parse";

describe("isMeaningfulTranslation", () => {
  it("应过滤空白与纯标点符号占位符", () => {
    expect(isMeaningfulTranslation("")).toBe(false);
    expect(isMeaningfulTranslation("   ")).toBe(false);
    expect(isMeaningfulTranslation("//")).toBe(false);
    expect(isMeaningfulTranslation(" // ")).toBe(false);
    expect(isMeaningfulTranslation("/")).toBe(false);
    expect(isMeaningfulTranslation("///")).toBe(false);
    expect(isMeaningfulTranslation("---")).toBe(false);
    expect(isMeaningfulTranslation("……")).toBe(false);
    expect(isMeaningfulTranslation("~~~")).toBe(false);
  });

  it("应过滤平台版权与著作权水印", () => {
    expect(isMeaningfulTranslation("QQ音乐享有本翻译作品的著作权")).toBe(false);
    expect(isMeaningfulTranslation("TME享有本翻译作品的著作权")).toBe(false);
    expect(isMeaningfulTranslation("本作品的著作权由原作者所有")).toBe(false);
    expect(isMeaningfulTranslation("版权所有，未经许可不得翻唱")).toBe(false);
  });

  it("应过滤大模型与机器翻译声明", () => {
    expect(isMeaningfulTranslation("以下歌词翻译由文曲大模型提供")).toBe(false);
    expect(isMeaningfulTranslation("本行歌词由机器翻译生成")).toBe(false);
  });

  it("正常歌词内容应正常放行", () => {
    expect(isMeaningfulTranslation("爱的诀窍是什么")).toBe(true);
    expect(isMeaningfulTranslation("All Falls Down")).toBe(true);
    expect(isMeaningfulTranslation("全体肃立")).toBe(true);
    expect(isMeaningfulTranslation("砰砰")).toBe(true);
    expect(isMeaningfulTranslation("我爱你")).toBe(true);
  });

  it("支持追加自定义关键字过滤", () => {
    expect(isMeaningfulTranslation("广告赞助商冠名", ["广告赞助商"])).toBe(false);
    expect(isMeaningfulTranslation("普通歌词行", ["广告赞助商"])).toBe(true);
  });

  it("在 parseLyric 对齐翻译时应自动过滤无意义占位符与版权行", () => {
    const res = parseLyric({
      content: "[00:00.00]Song Title\n[00:01.00]Lyrics by Artist\n[00:02.00]First line",
      translation: "[00:00.00]QQ音乐享有本翻译作品的著作权\n[00:01.00]//\n[00:02.00]第一句歌词",
    });

    expect(res.lines[0].translatedLyric).toBe("");
    expect(res.lines[1].translatedLyric).toBe("");
    expect(res.lines[2].translatedLyric).toBe("第一句歌词");
  });

  it("在解析同文件内的 LRC 翻译时也应过滤", () => {
    const res = parseLyric("[00:01.00]主歌词\n[00:01.00]以下歌词翻译由文曲大模型提供");

    expect(res.lines).toHaveLength(1);
    expect(res.lines[0].translatedLyric).toBe("");
  });
});
