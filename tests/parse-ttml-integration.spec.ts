import { describe, expect, it } from "vitest";
import { parseTTML } from "../src/parse";

const COMPLEX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml"
    xmlns:ttm="http://www.w3.org/ns/ttml#metadata"
    xmlns:itunes="http://itunes.apple.com/lyric-ttml-extensions"
    xmlns:amll="http://www.example.com/ns/amll"
    xml:lang="ja"
    itunes:timing="Word">

    <head>
        <metadata>
            <ttm:title>Complex Test Song</ttm:title>

            <ttm:agent type="person" xml:id="v1">
                <ttm:name type="full">Vocalist A (Taro)</ttm:name>
            </ttm:agent>
            <ttm:agent type="person" xml:id="v2">
                <ttm:name type="full">Vocalist B (Hanako)</ttm:name>
            </ttm:agent>
            <ttm:agent type="group" xml:id="v1000">
                <ttm:name type="full">Chorus Group</ttm:name>
            </ttm:agent>

            <amll:meta key="musicName" value="複雑なテストソング" />
            <amll:meta key="artists" value="Vocalist A (Taro)" />
            <amll:meta key="artists" value="Vocalist B (Hanako)" />
            <amll:meta key="album" value="AMLL Parser Test Suite" />
            <amll:meta key="isrc" value="JPXX02500001" />

            <amll:meta key="ncmMusicId" value="123456789" />
            <amll:meta key="qqMusicId" value="987654321" />
            <amll:meta key="spotifyId" value="abc123xyz" />
            <amll:meta key="appleMusicId" value="999888777" />

            <amll:meta key="ttmlAuthorGithub" value="10001" />
            <amll:meta key="ttmlAuthorGithubLogin" value="TestUser" />

            <iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal">
                <songwriters>
                    <songwriter>作曲者1号</songwriter>
                    <songwriter>作曲者2号</songwriter>
                </songwriters>
                <translations>
                    <translation type="subtitle" xml:lang="en-US">
                        <text for="L1">This is the first line (Vocalist A)</text>
                        <text for="L2">This is the second line (Vocalist B)</text>
                        <text for="L3"> This is the chorus line <span ttm:role="x-bg">(With
                            background)</span>
                        </text>
                    </translation>
                    <translation type="subtitle" xml:lang="zh-Hans-CN">
                        <text for="L1">这是第一行歌词 (演唱者A)</text>
                        <text for="L2">这是第二行歌词 (演唱者B)</text>
                        <text for="L3"> 这是合唱部分 <span ttm:role="x-bg">(带背景音)</span>
                        </text>
                    </translation>
                </translations>

                <transliterations>
                    <transliteration xml:lang="ja-Latn">
                        <text for="L1">
                            <span begin="00:10.000" end="00:10.500">Ko</span>
                            <span begin="00:10.500" end="00:10.800">re </span>
                            <span begin="00:10.800" end="00:11.000">wa </span>
                            <span begin="00:11.200" end="00:11.800">tesuto</span>
                        </text>
                        <text for="L2">
                            <span begin="00:15.000" end="00:15.800">Futatsume </span>
                            <span begin="00:16.000" end="00:16.500">no </span>
                            <span begin="00:16.500" end="00:17.000">rain</span>
                        </text>
                        <text for="L3">
                            <span begin="00:20.000" end="00:21.500">Kōrasu </span>
                            <span begin="00:21.500" end="00:22.000">desu</span>
                            <span ttm:role="x-bg">
                                <span begin="00:22.500" end="00:23.800">(haikei)</span>
                            </span>
                        </text>
                    </transliteration>
                </transliterations>
            </iTunesMetadata>
        </metadata>
    </head>

    <body dur="00:30.000">
        <div begin="00:08.000" end="00:18.000" itunes:song-part="Verse">
            <p begin="00:10.000" end="00:12.000" itunes:key="L1" ttm:agent="v1">
                <span begin="00:10.000" end="00:10.500" amll:obscene="true">これ</span>
                <span begin="00:10.500" end="00:10.800">は </span>
                <span begin="00:11.200" end="00:11.800" amll:empty-beat="5">テスト</span>
            </p>

            <p begin="00:15.000" end="00:17.000" itunes:key="L2" ttm:agent="v2">
                <span begin="00:15.000" end="00:15.800">二つ目 </span>
                <span begin="00:16.000" end="00:16.500">の </span>
                <span begin="00:16.500" end="00:17.000">ライン</span>
            </p>
        </div>

        <div begin="00:19.000" end="00:30.000" itunes:song-part="Chorus">
            <p begin="00:20.000" end="00:25.000" itunes:key="L3" ttm:agent="v1000">
                <span begin="00:20.000" end="00:21.500">コーラス </span>
                <span begin="00:21.500" end="00:22.000">です</span>

                <span ttm:role="x-bg" begin="00:22.500" end="00:23.800" ttm:agent="v1">
                    <span begin="00:22.500" end="00:23.800">(背景)</span>
                    <span ttm:role="x-translation" xml:lang="en">Background</span>
                    <span ttm:role="x-roman" xml:lang="ja-Latn">haikei</span>
                </span>
            </p>
        </div>
    </body>
</tt>`;

const RUBY_XML = `<tt xmlns="http://www.w3.org/ns/ttml"
    xmlns:ttm="http://www.w3.org/ns/ttml#metadata"
    xmlns:tts="http://www.w3.org/ns/ttml#styling"
    xmlns:itunes="http://music.apple.com/lyric-ttml-internal"
    itunes:timing="Word"
    xml:lang="ja">
    <head>
        <metadata>
            <ttm:agent type="person" xml:id="v1" />
        </metadata>
    </head>
    <body dur="28.000">
        <div begin="27.000" end="28.000">
            <p begin="27.000" end="28.000" itunes:key="L1" ttm:agent="v1">
                <span begin="27.000" end="27.500">これは</span>
                <span tts:ruby="container">
                    <span tts:ruby="base">所</span>
                    <span tts:ruby="textContainer">
                        <span tts:ruby="text" begin="27.690" end="27.820">しょ</span>
                    </span>
                </span>
                <span tts:ruby="container">
                    <span tts:ruby="base">詮</span>
                    <span tts:ruby="textContainer">
                        <span tts:ruby="text" begin="27.820" end="27.880">せ</span>
                        <span tts:ruby="text" begin="27.880" end="27.950">ん</span>
                    </span>
                </span>
            </p>
        </div>
    </body>
</tt>`;

describe("AMLL TTML 对齐集成测试", () => {
  it("应完全解析 AMLL complex-test-song 的所有元数据", () => {
    const result = parseTTML(COMPLEX_XML, { extractMetadata: true });

    expect(result.metadata.language).toBe("ja");
    expect(result.metadata.timingMode).toBe("Word");

    expect(result.metadata.title).toEqual(["Complex Test Song", "複雑なテストソング"]);
    expect(result.metadata.artist).toEqual(["Vocalist A (Taro)", "Vocalist B (Hanako)"]);
    expect(result.metadata.album).toEqual(["AMLL Parser Test Suite"]);
    expect(result.metadata.isrc).toEqual(["JPXX02500001"]);
    expect(result.metadata.songwriters).toEqual(["作曲者1号", "作曲者2号"]);
    expect(result.metadata.authorIds).toEqual(["10001"]);
    expect(result.metadata.authorNames).toEqual(["TestUser"]);

    expect(result.metadata.platformIds?.ncmMusicId).toEqual(["123456789"]);
    expect(result.metadata.platformIds?.qqMusicId).toEqual(["987654321"]);
    expect(result.metadata.platformIds?.spotifyId).toEqual(["abc123xyz"]);
    expect(result.metadata.platformIds?.appleMusicId).toEqual(["999888777"]);

    expect(result.metadata.agents?.v1?.name).toBe("Vocalist A (Taro)");
    expect(result.metadata.agents?.v2?.name).toBe("Vocalist B (Hanako)");
    expect(result.metadata.agents?.v1000?.name).toBe("Chorus Group");
  });

  it("应完全解析 AMLL complex-test-song 的歌词行、分段与特性", () => {
    const { lines } = parseTTML(COMPLEX_XML, {
      preferredLang: "zh-Hans-CN",
    });

    // 包含 L1, L2, L3 以及 L3 的背景音行
    expect(lines).toHaveLength(4);

    // L1 行
    const l1 = lines[0];
    expect(l1.id).toBe("L1");
    expect(l1.songPart).toBe("Verse");
    expect(l1.blockIndex).toBe(1);
    expect(l1.agentId).toBe("v1");
    expect(l1.startTime).toBe(10000);
    expect(l1.endTime).toBe(12000);
    expect(l1.translatedLyric).toBe("这是第一行歌词 (演唱者A)");
    expect(l1.romanLyric).toBe("Ko re wa tesuto");

    expect(l1.words).toHaveLength(3);
    expect(l1.words[0]).toEqual({
      word: "これ",
      startTime: 10000,
      endTime: 10500,
      obscene: true,
      romanWord: "Ko",
    });
    expect(l1.words[1]).toEqual({
      word: "は ",
      startTime: 10500,
      endTime: 10800,
      romanWord: "re",
    });
    expect(l1.words[2]).toEqual({
      word: "テスト",
      startTime: 11200,
      endTime: 11800,
      emptyBeat: 5,
      romanWord: "tesuto",
    });

    // L2 行
    const l2 = lines[1];
    expect(l2.id).toBe("L2");
    expect(l2.songPart).toBe("Verse");
    expect(l2.agentId).toBe("v2");
    expect(l2.isDuet).toBe(true);
    expect(l2.startTime).toBe(15000);
    expect(l2.endTime).toBe(17000);
    expect(l2.translatedLyric).toBe("这是第二行歌词 (演唱者B)");
    expect(l2.words).toHaveLength(3);
    expect(l2.words[0].word).toBe("二つ目 ");
    expect(l2.words[1].word).toBe("の ");
    expect(l2.words[2].word).toBe("ライン");

    // L3 行（主唱行）
    const l3 = lines[2];
    expect(l3.id).toBe("L3");
    expect(l3.songPart).toBe("Chorus");
    expect(l3.blockIndex).toBe(2);
    expect(l3.agentId).toBe("v1000");
    expect(l3.startTime).toBe(20000);
    expect(l3.endTime).toBe(25000);
    expect(l3.words[0].word).toBe("コーラス ");
    expect(l3.words[1].word).toBe("です");

    // L3 背景行
    const l3Bg = lines[3];
    expect(l3Bg.isBG).toBe(true);
    expect(l3Bg.agentId).toBe("v1");
    expect(l3Bg.startTime).toBe(22500);
    expect(l3Bg.endTime).toBe(23800);
    expect(l3Bg.words.map((w) => w.word).join("")).toBe("背景");
    // 背景行翻译应提取到（来自 sidecar 或行内）
    expect(l3Bg.translatedLyric).toBeTruthy();
    expect(l3Bg.romanLyric).toBe("haikei");
  });

  it("应解析 ruby-test-song 中的纯秒数时间与多个连续注音", () => {
    const { lines } = parseTTML(RUBY_XML);

    expect(lines).toHaveLength(1);
    const line = lines[0];
    expect(line.startTime).toBe(27000);
    expect(line.endTime).toBe(28000);
    expect(line.words).toHaveLength(3);

    // 第一词：普通词 "これは"
    expect(line.words[0].word).toBe("これは");
    expect(line.words[0].startTime).toBe(27000);
    expect(line.words[0].endTime).toBe(27500);

    // 第二词：Ruby "所"（しょ：27690~27820）
    const wordSho = line.words[1];
    expect(wordSho.word).toBe("所");
    expect(wordSho.startTime).toBe(27690);
    expect(wordSho.endTime).toBe(27820);
    expect(wordSho.ruby).toHaveLength(1);
    expect(wordSho.ruby?.[0]).toEqual({
      word: "しょ",
      startTime: 27690,
      endTime: 27820,
    });

    // 第三词：Ruby "詮"（せん：27820~27950，由 "せ" 和 "ん" 组成）
    const wordSen = line.words[2];
    expect(wordSen.word).toBe("詮");
    expect(wordSen.startTime).toBe(27820);
    expect(wordSen.endTime).toBe(27950);
    expect(wordSen.ruby).toHaveLength(2);
    expect(wordSen.ruby?.[0]).toEqual({
      word: "せ",
      startTime: 27820,
      endTime: 27880,
    });
    expect(wordSen.ruby?.[1]).toEqual({
      word: "ん",
      startTime: 27880,
      endTime: 27950,
    });
  });

  it("背景歌词应继承所属主行的对唱状态并剥离多层括号", () => {
    const duetXml = `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml"
    xmlns:ttm="http://www.w3.org/ns/ttml#metadata"
    xmlns:itunes="http://itunes.apple.com/lyric-ttml-extensions">
    <head>
        <metadata>
            <ttm:agent type="person" xml:id="v1" />
            <ttm:agent type="person" xml:id="v2" />
        </metadata>
    </head>
    <body>
        <div>
            <p begin="0s" end="2s" ttm:agent="v1">
                Main 1 <span ttm:role="x-bg">((Bg 1))</span>
            </p>
            <p begin="3s" end="5s" ttm:agent="v2">
                Main 2 <span ttm:role="x-bg">((Bg 2))</span>
            </p>
        </div>
    </body>
</tt>`;
    const { lines } = parseTTML(duetXml);
    expect(lines).toHaveLength(4);

    expect(lines[0].isDuet).toBe(false);
    expect(lines[1].isBG).toBe(true);
    expect(lines[1].isDuet).toBe(false);
    expect(lines[1].words.map((w) => w.word).join("")).toBe("Bg 1");

    expect(lines[2].isDuet).toBe(true);
    expect(lines[3].isBG).toBe(true);
    expect(lines[3].isDuet).toBe(true);
    expect(lines[3].words.map((w) => w.word).join("")).toBe("Bg 2");
  });

  it("应正确解析类似《薛之谦 - 洛城》的多字背景音且完全剥离首尾半角括号", () => {
    const luochengXml = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
      <body><div><p begin="00:38.820" end="00:47.438">
        <span begin="00:38.820" end="00:43.402">那支金箭穿过英雄的脚踵</span>
        <span ttm:role="x-bg" begin="00:43.402" end="00:47.438">
          <span begin="00:43.402" end="00:43.543">(你</span><span begin="00:43.543" end="00:43.672">惹</span><span begin="00:43.672" end="00:43.838">尘</span><span begin="00:43.838" end="00:44.350">埃</span> <span begin="00:44.350" end="00:44.558">八</span><span begin="00:44.558" end="00:44.726">千</span><span begin="00:44.725" end="00:45.047">里</span><span begin="00:45.047" end="00:45.389">外</span> <span begin="00:45.389" end="00:45.566">云</span><span begin="00:45.566" end="00:45.784">和</span><span begin="00:45.784" end="00:46.070">月</span><span begin="00:46.070" end="00:46.370">被</span><span begin="00:46.370" end="00:46.631">断</span><span begin="00:46.631" end="00:46.801">章</span><span begin="00:46.801" end="00:47.059">晕</span><span begin="00:47.059" end="00:47.438">红)</span>
        </span>
      </p></div></body></tt>`;
    const { lines } = parseTTML(luochengXml);
    expect(lines).toHaveLength(2);
    expect(lines[0].isBG).toBe(false);
    expect(lines[1].isBG).toBe(true);
    expect(lines[1].words[0].word).toBe("你");
    expect(lines[1].words[lines[1].words.length - 1].word).toBe("红");
    const fullBgText = lines[1].words.map((word) => word.word).join("");
    expect(fullBgText).toBe("你惹尘埃 八千里外 云和月被断章晕红");
  });
});
