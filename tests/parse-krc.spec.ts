import { describe, expect, it } from "vitest";
import { parseKRC } from "../src/parse";

describe("parseKRC", () => {
  it("应解析酷狗 KRC 纯文本逐字", () => {
    // [00:01.000]<0,500>酷<500,500>狗<1000,500>音<1500,500>乐
    const text = `[00:01.000]<0,500>酷<500,500>狗<1000,500>音<1500,500>乐`;
    const { lines, metadata } = parseKRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(1000);
    expect(lines[0].endTime).toBe(3000);
    expect(lines[0].words).toHaveLength(4);
    expect(lines[0].words[0]).toEqual({ word: "酷", startTime: 1000, endTime: 1500 });
    expect(lines[0].words[3]).toEqual({ word: "乐", startTime: 2500, endTime: 3000 });
    expect(metadata).toEqual({});
  });

  it("应兼容官方三参数逐字标签与毫秒整数行头", () => {
    const text = `[1000,2000]<0,500,0>测<500,500,0>试`;
    const { lines } = parseKRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(1000);
    expect(lines[0].endTime).toBe(3000);
    expect(lines[0].words[0]).toEqual({ word: "测", startTime: 1000, endTime: 1500 });
    expect(lines[0].words[1]).toEqual({ word: "试", startTime: 1500, endTime: 2000 });
  });

  it("正确解析毫秒位数", () => {
    // 注意 KRC 的规范是毫秒不 padEnd，例如 [00:01.5] 代表 1005ms
    const text = `[00:01.5]<0,300>字`;
    const { lines } = parseKRC(text);

    expect(lines[0].startTime).toBe(1005);
    expect(lines[0].endTime).toBe(1305);
  });

  it("应支持提取 KRC 元数据", () => {
    const text = `[ti:青花瓷]\n[ar:周杰伦]\n[al:我很忙]\n[00:01.000]<0,500>天<500,500>青`;
    const { lines, metadata } = parseKRC(text, { extractMetadata: true });

    expect(lines).toHaveLength(1);
    expect(metadata.title).toEqual(["青花瓷"]);
    expect(metadata.artist).toEqual(["周杰伦"]);
    expect(metadata.album).toEqual(["我很忙"]);
  });

  it("应正确解析西文词间空格", () => {
    const text = `[00:01.000]<0,500>Hello <500,500>World`;
    const { lines } = parseKRC(text);

    expect(lines).toHaveLength(1);
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0].word).toBe("Hello ");
    expect(lines[0].words[1].word).toBe("World");
  });

  it("应保留独立空白词", () => {
    const text = `[00:01.000]<0,500>Hello<500,500> <1000,500>World`;
    const { lines } = parseKRC(text);

    expect(lines[0].startTime).toBe(1000);
    expect(lines[0].endTime).toBe(2500);
    expect(lines[0].words).toHaveLength(3);
    expect(lines[0].words[0]).toEqual({
      word: "Hello",
      startTime: 1000,
      endTime: 1500,
    });
    expect(lines[0].words[1]).toEqual({ word: " ", startTime: 1500, endTime: 2000 });
    expect(lines[0].words[2]).toEqual({ word: "World", startTime: 2000, endTime: 2500 });
  });

  it("应支持解析酷狗 [language:...] 中的 Base64 翻译与音译", () => {
    const payload = {
      content: [
        { type: 1, lyricContent: [["翻译第一行"], ["翻译第二行"]] },
        { type: 0, lyricContent: [["Roman 1"], ["Roman 2"]] },
      ],
    };
    const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
    const binary = Array.from(jsonBytes, (byte) => String.fromCharCode(byte)).join("");
    const b64 = globalThis.btoa(binary);
    const text = `[language:${b64}]\n[1000,1000]<0,500>主<500,500>词\n[2000,1000]<0,500>二<500,500>行`;
    const { lines, metadata } = parseKRC(text, { extractMetadata: true });

    expect(lines).toHaveLength(2);
    expect(lines[0].translatedLyric).toBe("翻译第一行");
    expect(lines[0].romanLyric).toBe("Roman 1");
    expect(lines[1].translatedLyric).toBe("翻译第二行");
    expect(lines[1].romanLyric).toBe("Roman 2");
    expect(metadata.timingMode).toBe("Word");
  });

  it("应支持 [language:...] 标签位于歌词文件尾部时的正确回填", () => {
    const payload = {
      content: [
        { type: 1, lyricContent: [["尾部翻译1"], ["尾部翻译2"]] },
        { type: 0, lyricContent: [["Tail 1"], ["Tail 2"]] },
      ],
    };
    const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
    const binary = Array.from(jsonBytes, (byte) => String.fromCharCode(byte)).join("");
    const b64 = globalThis.btoa(binary);
    const text = `[1000,1000]<0,500>主<500,500>词\n[2000,1000]<0,500>二<500,500>行\n[language:${b64}]`;
    const { lines } = parseKRC(text, { extractMetadata: true });

    expect(lines).toHaveLength(2);
    expect(lines[0].translatedLyric).toBe("尾部翻译1");
    expect(lines[0].romanLyric).toBe("Tail 1");
    expect(lines[1].translatedLyric).toBe("尾部翻译2");
    expect(lines[1].romanLyric).toBe("Tail 2");
  });
});
