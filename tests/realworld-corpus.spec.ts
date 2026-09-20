import { describe, expect, it } from "vitest";
import { stripLyricMetadata } from "../src/clean/stripper";
import { detectFormat, parseLyric } from "../src/parse";
import { parseKRC } from "../src/parse/krc";
import { parseLRC } from "../src/parse/lrc";
import { parseQRC } from "../src/parse/qrc";
import { parseTTML } from "../src/parse/ttml";
import { parseYRC } from "../src/parse/yrc";

/**
 * 真实平台语料测试
 * 覆盖 netease lrc/yrc、kugou krc、qqmusic qrc 的真实生产格式
 */

// netease 2639639291：主歌词 + 翻译 + 罗马音三轨（节选，保留 JSON 元数据行与首两行歌词）
const NETEASE_LRC_MAIN = `{"t":0,"c":[{"tx":"作词: "},{"tx":"AzureHead"},{"/"},{"tx":"堀江晶太","li":"http://p1.music.126.net/YdenxD94nV-hy7FSGygIpg==/109951165256208349.jpg","or":"orpheus://nm/artist/home?id=13735132&type=artist"}]}
{"t":1000,"c":[{"tx":"作曲: "},{"tx":"崔瀚普TSAR (HOYO-MiX)"}]}
[00:21.831]覚醒 READY OK
[00:23.776]
[00:23.937]今宵 思い切り 白黒つけようぜ
{"t":137391,"c":[{"tx":"人声 Vocal Artist: "},{"tx":"Reol"}]}`;

const NETEASE_LRC_TRANSLATION = `[00:21.831]该觉醒了Ready， ok？
[00:23.776]
[00:23.937]今晚，就下定决心做个了断
[02:18.321]人声 Vocal Artist：Reol`;

const NETEASE_LRC_ROMAJI = `[00:21.831]ka ku se i READY OK
[00:23.776]
[00:23.937]ko yo i o mo i ki ri shi ro ku ro tsu ke yo u ze`;

// netease 1334672916：YRC 纯音乐，JSON 元数据带负数 t
const NETEASE_YRC_INSTRUMENTAL = `{"t":-1000,"c":[{"tx":"作曲: "},{"tx":"蔡近翰Zoe (HOYO-MiX)"}]}
{"t":-500,"c":[{"tx":"编曲: "},{"tx":"郑宇界JODODO(HOYO-MiX)"}]}
[0,117990](0,14740,0)出(14740,14740,0)品 (29480,14740,0)Produced (44220,14740,0)by(58960,14740,0):(73700,14740,0)HOYO(88440,14740,0)-(103180,14810,0)MiX`;

// kugou 06535ba93c2bec54d102c2cffcfac052：解密后的明文 KRC
const KUGOU_KRC_PLAINTEXT = `[ar:arkady sevidov]
[ti:June]
[by:]
[hash:4399c9872c7235b60b58ce88dc487897]
[al:]
[sign:]
[qq:]
[total:320317]
[offset:0]
[00:01.589]<0,354>纯<354,505>音<859,406>乐<1265,304>，<1569,252>请<1821,405>欣<2226,303>赏`;

// netease 1969519579：主/翻译用 QQ 式 [mm:ss:cs] 冒号厘秒时间戳，罗马音用标准 [mm:ss.xxx] 且时间有偏差（节选）
const NETEASE_LRC_COLON_CS_MAIN = `{"t":0,"c":[{"tx":"作词: "},{"tx":"shito"}]}
[00:11:95]私が私の事を愛して
[00:15:27]何が悪いの？嫉妬でしょうか？
[00:42:21]Chu！ 可愛くてごめん`;

const NETEASE_LRC_COLON_CS_TRANSLATION = `[00:11:95]我爱我自己
[00:15:27]有什么不行的？你是不是嫉妒了？
\t
[00:42:21]啾！ 我这么可爱真是抱歉`;

const NETEASE_LRC_COLON_CS_ROMAJI = `[00:12.025]wa ta shi ga wa ta shi no ko to wo a i shi te
[00:15.233]na ni ga wa ru i no?shi tto de sho u ka?
[00:42.424]Chu! ka wa i ku te go me n`;

// qqmusic 447822：XML 包裹 QRC（LyricContent 属性含真实换行，节选）
const QQ_QRC_XML = `<?xml version="1.0" encoding="utf-8"?>
<QrcInfos>
<QrcHeadInfo SaveTime="314" Version="100"/>
<LyricInfo LyricCount="1">
<Lyric_1 LyricType="1" LyricContent="[ti:如烟]
[ar:五月天]
[al:后青春期的诗]
[by:]
[offset:0]
[0,3470]如(0,289)烟(289,289) (578,289)-(867,289) (1156,289)五(1445,289)月(1734,289)天(2023,289) (2312,289)((2601,289)Mayday(2890,289))(3179,289)
[3470,3470]词(3470,867)：(4337,867)阿(5204,867)信(6071,867)
[10412,2492]我(10412,497)坐(10909,187)在(11096,724)床(11820,684)前(12504,400)
"/>
</LyricInfo>
</QrcInfos>`;

describe("真实语料格式探测", () => {
  it("四种平台原始文本应被正确探测", () => {
    expect(detectFormat(NETEASE_LRC_MAIN)).toBe("lrc");
    expect(detectFormat(NETEASE_YRC_INSTRUMENTAL)).toBe("yrc");
    expect(detectFormat(KUGOU_KRC_PLAINTEXT)).toBe("krc");
    expect(detectFormat(QQ_QRC_XML)).toBe("qrc");
  });
});

describe("netease LRC（JSON 元数据行 + 三轨配对）", () => {
  it("JSON 元数据行不应产生歌词行，正文正常解析", () => {
    const { lines } = parseLRC(NETEASE_LRC_MAIN);
    // 2 行正文；JSON 元数据行与空行标记（keepEmptyLines 默认 false）均不产出歌词行
    expect(lines).toHaveLength(2);
    expect(lines[0].words.map((w) => w.word).join("")).toBe("覚醒 READY OK");
    expect(lines[0].startTime).toBe(21831);
    // 被过滤的空行标记 [00:23.776] 仍作为时间截止标记界定了首行结束时间
    expect(lines[0].endTime).toBe(23776);
  });

  it("parseLyric 三轨输入应按时间戳配对翻译与罗马音", () => {
    const { lines } = parseLyric({
      content: NETEASE_LRC_MAIN,
      translation: NETEASE_LRC_TRANSLATION,
      romaji: NETEASE_LRC_ROMAJI,
    });
    const first = lines[0];
    expect(first.translatedLyric).toBe("该觉醒了Ready， ok？");
    expect(first.romanLyric).toBe("ka ku se i READY OK");
    // 翻译轨中的尾部元数据行（02:18.321）找不到主轨对应行，不应污染任何主行
    const polluted = lines.some((line) => /Reol/.test(line.translatedLyric));
    expect(polluted).toBe(false);
  });
});

describe("netease YRC 纯音乐（负数 t 元数据）", () => {
  it("应解析逐字行并从 JSON 元数据提取幕后人员", () => {
    const { lines, metadata } = parseYRC(NETEASE_YRC_INSTRUMENTAL, { extractMetadata: true });
    expect(lines).toHaveLength(1);
    expect(lines[0].startTime).toBe(0);
    expect(lines[0].endTime).toBe(117990);

    const words = lines[0].words;
    expect(words[0]).toMatchObject({ word: "出", startTime: 0, endTime: 14740 });
    expect(words[2]).toMatchObject({ word: "Produced " });
    expect(words[words.length - 1]).toMatchObject({ word: "MiX", endTime: 117990 });

    // 作曲/编曲均归入 songwriters；负数 t 不影响解析
    expect(metadata.songwriters).toEqual(["蔡近翰Zoe (HOYO-MiX)", "郑宇界JODODO(HOYO-MiX)"]);
  });
});

describe("kugou KRC 明文", () => {
  it("应解析 [mm:ss.xxx] 行头与 <offset,dur> 逐字时间", () => {
    const { lines, metadata } = parseKRC(KUGOU_KRC_PLAINTEXT, { extractMetadata: true });
    expect(lines).toHaveLength(1);

    const line = lines[0];
    expect(line.startTime).toBe(1589);
    // 无 [start,dur] 行头时行结束时间回退为末词结束
    expect(line.endTime).toBe(3815 + 303);

    const words = line.words;
    expect(words).toHaveLength(7);
    expect(words[0]).toMatchObject({ word: "纯", startTime: 1589, endTime: 1943 });
    expect(words[6]).toMatchObject({ word: "赏", startTime: 3815, endTime: 4118 });

    // kugou 私有标签进 rawProperties，total 时长保留
    expect(metadata.rawProperties?.total).toEqual(["320317"]);
    expect(metadata.timingMode).toBe("Word");
  });
});

describe("netease LRC 冒号厘秒时间戳 [mm:ss:cs]（QQ 式变体）", () => {
  it("冒号分隔两位小数应按厘秒解析（95 → 950ms）", () => {
    const { lines } = parseLRC(NETEASE_LRC_COLON_CS_MAIN);
    expect(lines).toHaveLength(3);
    expect(lines[0].startTime).toBe(11_950);
    expect(lines[1].startTime).toBe(15_270);
    expect(lines[2].startTime).toBe(42_210);
    // 无空行标记时行结束时间由下一行起始时间界定
    expect(lines[0].endTime).toBe(15_270);
  });

  it("三轨输入：同格式翻译精确配对，毫秒偏差罗马音走 300ms 容差配对", () => {
    const { lines } = parseLyric({
      content: NETEASE_LRC_COLON_CS_MAIN,
      translation: NETEASE_LRC_COLON_CS_TRANSLATION,
      romaji: NETEASE_LRC_COLON_CS_ROMAJI,
    });
    expect(lines).toHaveLength(3);
    // 翻译同时间戳精确配对
    expect(lines[0].translatedLyric).toBe("我爱我自己");
    // 罗马音 [00:12.025] vs 主轨 [00:11:95]（11950ms）偏差 75ms，容差内配对
    expect(lines[0].romanLyric).toBe("wa ta shi ga wa ta shi no ko to wo a i shi te");
    // 末行偏差 42424 - 42210 = 214ms，仍在容差内
    expect(lines[2].romanLyric).toBe("Chu! ka wa i ku te go me n");
    // 翻译轨中的制表符空行不应产出任何歌词行
    expect(lines.every((line) => line.translatedLyric !== "")).toBe(true);
  });
});

// qqmusic 00143oHM1QyWbx（我们都拥有海洋）：双 agent 对唱 + 嵌套 x-bg + m:ss.xxx 混合时间（节选）
const QQ_TTML_DUET = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:amll="http://www.example.com/ns/amll" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" itunes:timing="Word"><head><metadata><ttm:agent type="person" xml:id="v1"/><ttm:agent type="other" xml:id="v2"/><iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal"><songwriters><songwriter>Peng Fei</songwriter><songwriter>唐恬</songwriter></songwriters></iTunesMetadata><amll:meta key="musicName" value="我们都拥有海洋"/><amll:meta key="artists" value="吴青峰"/><amll:meta key="ttmlAuthorGithubLogin" value="Seayay"/></metadata></head><body dur="3:51.103"><div begin="1.670" end="3:51.103"><p begin="1.670" end="5.419" itunes:key="L1" ttm:agent="v1"><span begin="1.670" end="1.842">如</span><span begin="1.842" end="2.053">果</span><span begin="2.053" end="2.258">这</span><span begin="2.258" end="2.485">是</span><span begin="2.485" end="2.939">再</span><span begin="2.939" end="3.318">不</span><span begin="3.318" end="3.637">返</span><span begin="3.733" end="4.166">回</span><span begin="4.166" end="4.441">的</span><span begin="4.441" end="4.886">夏</span><span begin="4.886" end="5.419">天</span></p><p begin="27.012" end="28.618" itunes:key="L5" ttm:agent="v1"><span begin="27.012" end="27.495">去</span><span begin="27.495" end="28.618">哪</span></p><p begin="27.908" end="29.421" itunes:key="L6" ttm:agent="v2"><span begin="27.908" end="28.173">让</span><span begin="28.173" end="28.538">我</span><span begin="28.662" end="28.930">选</span><span begin="28.930" end="29.421">择</span></p><p begin="33.738" end="40.793" itunes:key="L9" ttm:agent="v1"><span begin="33.738" end="34.181">那</span><span begin="34.181" end="35.119">我</span><span begin="35.352" end="35.781">跑</span><span begin="35.810" end="36.196">的</span><span begin="36.196" end="36.479">脚</span><span begin="36.479" end="36.813">踝</span> <span begin="36.861" end="37.049">到</span><span begin="37.068" end="37.275">底</span><span begin="37.275" end="37.489">是</span><span begin="37.489" end="38.653">为</span><span begin="38.653" end="38.953">什</span><span begin="38.953" end="40.431">么</span><span ttm:role="x-bg" begin="34.524" end="40.765"><span begin="34.524" end="34.758">(长</span><span begin="34.787" end="35.123">奔</span><span begin="35.346" end="35.750">跑</span><span begin="35.805" end="36.154">的</span><span begin="36.172" end="36.419">脚</span><span begin="36.469" end="36.792">踝</span> <span begin="36.874" end="37.072">到</span><span begin="37.072" end="37.278">底</span><span begin="37.278" end="37.481">是</span><span begin="37.481" end="38.659">为</span><span begin="38.659" end="38.972">什</span><span begin="38.972" end="40.765">么)</span></span></p><p begin="57.471" end="1:01.680" itunes:key="L15" ttm:agent="v1"><span begin="57.471" end="57.688">为</span><span begin="57.688" end="57.872">何</span><span begin="57.890" end="58.089">每</span><span begin="58.089" end="58.258">一</span><span begin="58.258" end="58.706">站</span> <span begin="58.873" end="59.177">是</span><span begin="59.207" end="59.568">一</span><span begin="59.594" end="59.838">样</span><span begin="59.838" end="1:00.334">的</span><span begin="1:00.422" end="1:00.638">路</span><span begin="1:00.638" end="1:01.680">牌</span></p></div></body></tt>`;

// netease 2026565329（Da Capo）：x-translation 行内翻译 + amll:empty-beat + 00:mm:ss.xxx 前导零时间（节选）
const NETEASE_TTML_TRANSLATION = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xmlns:amll="http://www.example.com/ns/amll"><head><metadata xmlns=""><ttm:agent type="person" xml:id="v1"/><amll:meta key="ncmMusicId" value="2026565329"/><amll:meta key="musicName" value="Da Capo"/><amll:meta key="artists" value="HOYO-MiX"/><amll:meta key="ttmlAuthorGithubLogin" value="Magmeta"/></metadata></head><body dur="02:12.313"><div xmlns="" begin="00:01.093" end="02:12.313"><p begin="00:01.093" end="00:05.699" ttm:agent="v1" itunes:key="L1"><span begin="00:01.093" end="00:01.574">When</span> <span begin="00:01.574" end="00:01.932">good</span> <span begin="00:01.932" end="00:02.138">old</span> <span begin="00:02.138" end="00:02.746">friend</span><span begin="00:02.746" end="00:03.037">s are</span> <span begin="00:03.037" end="00:03.539">go</span><span begin="00:03.539" end="00:03.833">ing</span> <span begin="00:03.833" end="00:04.607">a</span><span begin="00:04.607" end="00:05.699">way</span><span ttm:role="x-translation" xml:lang="zh-CN">当曾经的挚友离开</span></p><p begin="01:59.997" end="02:12.313" ttm:agent="v1" itunes:key="L17"><span begin="01:59.997" end="02:00.145">“May</span> <span begin="02:00.145" end="02:00.337">you,</span> <span begin="02:00.337" end="02:00.507">the</span> <span begin="02:00.507" end="02:01.138">beau</span> <span begin="02:01.138" end="02:01.518">ty</span> <span begin="02:01.518" end="02:01.707">of</span> <span begin="02:01.707" end="02:01.868">this</span> <span begin="02:01.951" end="02:06.272" amll:empty-beat="4">world,</span> <span begin="02:07.662" end="02:08.066">al</span><span begin="02:08.066" end="02:08.413">ways</span> <span begin="02:08.413" end="02:12.313">shine.”</span><span ttm:role="x-translation" xml:lang="zh-CN">「你是世界上的美好，永远闪耀」</span></p></div></body></tt>`;

describe("真实 TTML 语料", () => {
  it("detectFormat 应将 TTML 文档与其他平台文本区分", () => {
    expect(detectFormat(QQ_TTML_DUET)).toBe("ttml");
    expect(detectFormat(NETEASE_TTML_TRANSLATION)).toBe("ttml");
  });

  it("双 agent 对唱 + 嵌套 x-bg（我们都拥有海洋）", () => {
    const { lines, metadata } = parseTTML(QQ_TTML_DUET, { extractMetadata: true });

    // agents 元数据与 iTunes songwriters
    expect(Object.keys(metadata.agents ?? {})).toEqual(["v1", "v2"]);
    expect(metadata.agents?.v1).toMatchObject({ id: "v1", type: "person" });
    expect(metadata.agents?.v2).toMatchObject({ id: "v2", type: "other" });
    expect(metadata.songwriters).toContain("唐恬");
    expect(metadata.authorNames).toEqual(["Seayay"]);

    // 首行 v1 非对唱标记
    expect(lines[0].isDuet).toBe(false);

    // v1 主声部（去哪）false；v2 对唱侧（让我选择）在 v1→v2 切换后标记为 true
    const quNa = lines.find((line) => line.words.map((w) => w.word).join("") === "去哪");
    const rangWo = lines.find((line) => line.words.map((w) => w.word).join("") === "让我选择");
    expect(quNa?.isDuet).toBe(false);
    expect(rangWo?.isDuet).toBe(true);
    // v1 回切后的主声部行恢复 false（跟踪翻转语义）
    const duetLine = lines.find((line) =>
      line.words
        .map((w) => w.word)
        .join("")
        .includes("那我跑的脚踝"),
    );
    expect(duetLine?.isDuet).toBe(false);

    // 嵌套 x-bg 背景和声独立成行，首尾括号默认被剥离
    const bgLine = lines.find((line) => line.isBG);
    expect(bgLine).toBeDefined();
    const bgText = bgLine?.words.map((w) => w.word).join("");
    expect(bgText).toBe("长奔跑的脚踝 到底是为什么");

    // m:ss.xxx 混合时间格式（1:01.680 → 61680ms）
    const luPai = lines.find((line) =>
      line.words
        .map((w) => w.word)
        .join("")
        .includes("路牌"),
    );
    expect(luPai?.startTime).toBe(57471);
    expect(luPai?.endTime).toBe(61680);
  });

  it("x-translation 行内翻译 + amll:empty-beat + 前导零时间（Da Capo）", () => {
    const { lines, metadata } = parseTTML(NETEASE_TTML_TRANSLATION, {
      extractMetadata: true,
    });

    // 00:mm:ss.xxx 前导零时间 → 1093ms
    expect(lines[0].startTime).toBe(1093);
    expect(lines[0].endTime).toBe(5699);

    // 行内 x-translation 写入 translatedLyric
    expect(lines[0].translatedLyric).toBe("当曾经的挚友离开");
    expect(lines[1].translatedLyric).toBe("「你是世界上的美好，永远闪耀」");

    // 西文单词保留空格
    const words = lines[0].words;
    expect(words.some((w) => w.word === "s are ")).toBe(true);
    expect(words[0].word).toBe("When ");

    // amll:empty-beat 保留到词属性
    const emptyBeatWord = lines[1].words.find((w) => w.word.trim() === "world,");
    expect(emptyBeatWord?.emptyBeat).toBe(4);

    // amll:meta 元数据
    expect(metadata.title).toContain("Da Capo");
    expect(metadata.artist).toContain("HOYO-MiX");
    expect(metadata.platformIds?.ncmMusicId).toEqual(["2026565329"]);
  });
});

describe("qqmusic QRC XML 包裹", () => {
  it("应从跨行 LyricContent 属性提取正文、元数据与逐字时间", () => {
    const { lines, metadata } = parseQRC(QQ_QRC_XML, { extractMetadata: true });
    expect(lines.length).toBeGreaterThanOrEqual(3);

    expect(metadata.title).toEqual(["如烟"]);
    expect(metadata.artist).toEqual(["五月天"]);
    expect(metadata.album).toEqual(["后青春期的诗"]);

    const first = lines[0];
    expect(first.startTime).toBe(0);
    expect(first.words[0]).toMatchObject({ word: "如", startTime: 0, endTime: 289 });
    expect(first.words[1]).toMatchObject({ word: "烟", startTime: 289, endTime: 578 });
    // 括号伴唱文本 ((Mayday)) 被背景人声检测拆分为独立 isBG 行，主行保留如烟 - 五月天
    expect(first.words.map((w) => w.word).join("")).toBe("如烟 - 五月天 ");
    const bgLine = lines.find((line) => line.isBG);
    expect(bgLine).toBeDefined();
    expect(bgLine?.words.map((w) => w.word).join("")).toContain("Mayday");
  });

  it("清洗元数据后应保留正文词内容", () => {
    const { lines } = parseLyric(QQ_QRC_XML);
    const first = lines.find((line) => !line.isBG);
    expect(first).toBeDefined();
    expect(first?.words.map((w) => w.word).join("")).toBe("如烟 - 五月天 ");
    // stripLyricMetadata 对词/曲署名行的清理走 anchored 规则，主歌词行不受影响
    const stripped = stripLyricMetadata(lines);
    const kept = stripped.find((line) =>
      line.words
        .map((w) => w.word)
        .join("")
        .includes("如烟"),
    );
    expect(kept).toBeDefined();
    expect(kept?.words.map((w) => w.word).join("")).toContain("五月天");
  });
});
