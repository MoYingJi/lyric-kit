import { describe, expect, it } from "vitest";
import { parseTTML } from "../src/parse";

describe("parseTTML", () => {
  it("应解析基础逐字 span 及对唱 agent", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <head>
    <metadata>
      <ttm:agent xml:id="v1" type="person"/>
      <ttm:agent xml:id="v2" type="person"/>
    </metadata>
  </head>
  <body>
    <div>
      <p begin="00:01.000" end="00:03.000" ttm:agent="v1">
        <span begin="00:01.000" end="00:02.000">Hello</span>
        <span begin="00:02.000" end="00:03.000">World</span>
      </p>
      <p begin="00:04.000" end="00:06.000" ttm:agent="v2">
        <span begin="00:04.000" end="00:06.000">Duet</span>
      </p>
    </div>
  </body>
</tt>`;
    const { lines, metadata } = parseTTML(xml);

    expect(lines).toHaveLength(2);
    expect(lines[0].startTime).toBe(1000);
    expect(lines[0].endTime).toBe(3000);
    expect(lines[0].isDuet).toBe(false);
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0].word).toBe("Hello");

    expect(lines[1].startTime).toBe(4000);
    expect(lines[1].isDuet).toBe(true);
    expect(metadata).toEqual({});
  });

  it("应解析 iTunes 翻译元数据", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <head>
    <metadata>
      <translations>
        <translation xml:lang="zh-CN">
          <text for="line1">你好世界</text>
        </translation>
      </translations>
    </metadata>
  </head>
  <body>
    <div>
      <p begin="00:01.000" end="00:02.000" key="line1">
        <span begin="00:01.000" end="00:02.000">Hello</span>
      </p>
    </div>
  </body>
</tt>`;
    const { lines } = parseTTML(xml, { preferredLang: "zh-CN" });

    expect(lines).toHaveLength(1);
    expect(lines[0].translatedLyric).toBe("你好世界");
  });

  it("应正确解析西文词间空格", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml">
  <body>
    <div>
      <p begin="00:01.000" end="00:03.000">
        <span begin="00:01.000" end="00:02.000">Hello </span>
        <span begin="00:02.000" end="00:03.000">World</span>
      </p>
    </div>
  </body>
</tt>`;
    const { lines } = parseTTML(xml);
    expect(lines).toHaveLength(1);
    expect(lines[0].words).toHaveLength(2);
    expect(lines[0].words[0].word).toBe("Hello ");
    expect(lines[0].words[1].word).toBe("World");
  });

  it("应解析 W3C TTML2 tts:ruby 容器（汉字与假名注音时间）", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
  <body>
    <div>
      <p begin="00:01.000" end="00:03.000">
        <span tts:ruby="container">
          <span tts:ruby="base" begin="00:01.000" end="00:02.000">漢字</span>
          <span tts:ruby="textContainer">
            <span tts:ruby="text" begin="00:01.000" end="00:01.500">かん</span>
            <span tts:ruby="text" begin="00:01.500" end="00:02.000">じ</span>
          </span>
        </span>
        <span begin="00:02.000" end="00:03.000">です</span>
      </p>
    </div>
  </body>
</tt>`;
    const { lines } = parseTTML(xml);
    expect(lines).toHaveLength(1);
    expect(lines[0].words).toHaveLength(2);

    const kanjiWord = lines[0].words[0];
    expect(kanjiWord.word).toBe("漢字");
    expect(kanjiWord.startTime).toBe(1000);
    expect(kanjiWord.endTime).toBe(2000);
    expect(kanjiWord.ruby).toBeDefined();
    expect(kanjiWord.ruby).toHaveLength(2);
    expect(kanjiWord.ruby?.[0]).toEqual({
      word: "かん",
      startTime: 1000,
      endTime: 1500,
    });
    expect(kanjiWord.ruby?.[1]).toEqual({
      word: "じ",
      startTime: 1500,
      endTime: 2000,
    });

    expect(lines[0].words[1].word).toBe("です");
  });

  it("应解析 itunes:song-part 分段与 blockIndex", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal">
  <body>
    <div itunes:song-part="Verse 1">
      <p begin="00:01.000" end="00:02.000">
        <span begin="00:01.000" end="00:02.000">Line 1</span>
      </p>
    </div>
    <div itunes:song-part="Chorus">
      <p begin="00:03.000" end="00:04.000">
        <span begin="00:03.000" end="00:04.000">Line 2</span>
      </p>
    </div>
  </body>
</tt>`;
    const { lines } = parseTTML(xml);
    expect(lines).toHaveLength(2);
    expect(lines[0].songPart).toBe("Verse 1");
    expect(lines[0].blockIndex).toBe(1);

    expect(lines[1].songPart).toBe("Chorus");
    expect(lines[1].blockIndex).toBe(2);
  });

  it("应解析 AMLL obscene 与 empty-beat 扩展属性", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:amll="http://www.example.com/ns/amll">
  <body>
    <div>
      <p begin="00:01.000" end="00:03.000">
        <span begin="00:01.000" end="00:02.000" amll:obscene="true">Explicit</span>
        <span begin="00:02.000" end="00:03.000" amll:empty-beat="3">Drop</span>
      </p>
    </div>
  </body>
</tt>`;
    const { lines } = parseTTML(xml);
    expect(lines).toHaveLength(1);
    expect(lines[0].words[0].word).toBe("Explicit");
    expect(lines[0].words[0].obscene).toBe(true);

    expect(lines[0].words[1].word).toBe("Drop");
    expect(lines[0].words[1].emptyBeat).toBe(3);
  });

  it("配置 { extractMetadata: true } 应返回元数据与歌词行", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml"
    xmlns:ttm="http://www.w3.org/ns/ttml#metadata"
    xmlns:amll="http://www.example.com/ns/amll"
    xmlns:itunes="http://music.apple.com/lyric-ttml-internal">
  <head>
    <metadata>
      <ttm:title>Test Title</ttm:title>
      <ttm:agent xml:id="v1" type="person">
        <ttm:name>Singer A</ttm:name>
      </ttm:agent>
      <amll:meta key="musicName" value="AMLL Title"/>
      <amll:meta key="artists" value="Singer A"/>
      <amll:meta key="album" value="Best Album"/>
      <amll:meta key="isrc" value="CN1234567890"/>
      <amll:meta key="ncmMusicId" value="10001"/>
      <amll:meta key="appleMusicId" value="20002"/>
      <iTunesMetadata>
        <songwriters>
          <songwriter>Songwriter Bob</songwriter>
        </songwriters>
      </iTunesMetadata>
    </metadata>
  </head>
  <body>
    <div>
      <p begin="00:01.000" end="00:02.000" ttm:agent="v1">
        <span begin="00:01.000" end="00:02.000">Hello</span>
      </p>
    </div>
  </body>
</tt>`;
    const result = parseTTML(xml, { extractMetadata: true });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].words[0].word).toBe("Hello");

    expect(result.metadata.title).toContain("Test Title");
    expect(result.metadata.title).toContain("AMLL Title");
    expect(result.metadata.artist).toContain("Singer A");
    expect(result.metadata.album).toContain("Best Album");
    expect(result.metadata.isrc).toContain("CN1234567890");
    expect(result.metadata.songwriters).toContain("Songwriter Bob");
    expect(result.metadata.platformIds?.ncmMusicId).toContain("10001");
    expect(result.metadata.platformIds?.appleMusicId).toContain("20002");
    expect(result.metadata.agents?.v1).toEqual({
      id: "v1",
      name: "Singer A",
      type: "person",
    });
  });

  it("应支持显式传入 domParser 构造函数或实例", () => {
    const xml = `<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="00:01.000" end="00:02.000"><span>Test</span></p></div></body></tt>`;
    const customParser = new DOMParser();
    const { lines } = parseTTML(xml, { domParser: customParser });
    expect(lines).toHaveLength(1);
    expect(lines[0].words[0].word).toBe("Test");
  });

  it("应支持 4 段式 SMPTE 格式时间戳（HH:MM:SS:FF）", () => {
    const xml = `<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="00:01:02:15" end="00:01:05:00"><span>SMPTE</span></p></div></body></tt>`;
    const { lines } = parseTTML(xml);
    expect(lines).toHaveLength(1);
    // 00:01:02:15 = 1分2秒 + 15帧(按30fps估算500ms) = 62500ms
    expect(lines[0].startTime).toBe(62500);
    // 00:01:05:00 = 1分5秒 = 65000ms
    expect(lines[0].endTime).toBe(65000);
  });

  it("应默认无条件剥离 TTML x-bg 背景音首尾括号", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <body>
    <div>
      <p begin="00:01.000" end="00:05.000">
        <span begin="00:01.000" end="00:02.000">主唱</span>
        <span ttm:role="x-bg" begin="00:02.000" end="00:05.000">
          <span begin="00:02.000" end="00:03.000">(伴</span>
          <span begin="00:03.000" end="00:04.000">唱</span>
          <span begin="00:04.000" end="00:05.000">音)</span>
        </span>
      </p>
    </div>
  </body>
</tt>`;
    const { lines } = parseTTML(xml);
    expect(lines).toHaveLength(2);
    expect(lines[0].isBG).toBe(false);
    expect(lines[0].words.map((word) => word.word).join("")).toBe("主唱");

    expect(lines[1].isBG).toBe(true);
    // 首尾括号应被完全剥除，变为干净的 "伴" "唱" "音"
    expect(lines[1].words.map((word) => word.word).join("")).toBe("伴唱音");
    expect(lines[1].words[0].word).toBe("伴");
    expect(lines[1].words[2].word).toBe("音");
  });
});
