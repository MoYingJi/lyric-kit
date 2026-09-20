# lyric-kit

用于解析、序列化及同步多格式歌词（LRC、TTML、QRC、KRC、YRC、LyS、SRT、ASS）的高性能 TypeScript 工具库。

[![npm version](https://img.shields.io/npm/v/lyric-kit.svg?color=3399ff)](https://www.npmjs.com/package/lyric-kit)
[![npm downloads](https://img.shields.io/npm/dm/lyric-kit.svg)](https://www.npmjs.com/package/lyric-kit)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](#)
[![Zero Dependency](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#)

[English](README.md) | 简体中文

## 安装

```bash
pnpm add lyric-kit
# 或
npm install lyric-kit
```

## 快速上手

### 解析歌词

`parseLyric` 支持传入纯歌词文本字符串，或包含翻译/罗马音的配置对象。

```ts
import { parseLyric } from "lyric-kit";

// 1. 传入纯文本（自动检测格式）
const { lines, metadata } = parseLyric(`
[ti:歌曲名]
[ar:歌手名]
[00:01.00]第一行歌词
[00:03.00]第二行歌词
`);

// 2. 传入主歌词、翻译与罗马音（自动时间戳对齐）
const result = parseLyric({
  content: "[00:01.00]Hello\n[00:03.00]Goodbye",
  translation: "[00:01.00]你好\n[00:03.00]再见",
  romaji: "[00:01.00]haro\n[00:03.00]gubbai",
});
```

### 序列化导出

支持使用独立序列化函数或统一入口 `serializeLyric`：

```ts
import { toEnhancedLRC, toLRC, toSRT, toTTML } from "lyric-kit";

// 导出为标准逐行 LRC 格式
const lrc = toLRC(lines);

// 逐字时间戳增强型 LRC 格式
const elrc = toEnhancedLRC(lines);

// Apple Music TTML XML 格式（支持传入 lines 或包含 metadata 的 result）
const ttml = toTTML(result);

// SubRip 字幕格式
const srt = toSRT(lines);

// 也可通过 serializeLyric 统一入口导出
import { serializeLyric } from "lyric-kit";
const output = serializeLyric(lines, "ttml");
```

### 清理元数据标头

过滤歌词开头的演职人员信息与版权声明等非歌词文本行：

```ts
import { stripLyricMetadata } from "lyric-kit";

const cleanedLines = stripLyricMetadata(lines, {
  matchMetadata: {
    title: "歌曲名",
    artists: ["歌手名"],
  },
});
```

### 智能推断歌词语言

自动结合假名振假名注音（ruby）、全曲翻译与 CJK 字符比例，为歌词行推断并注入语言代码（`ja` / `ko` / `zh-CN` / `und-Latn`），便于界面选择字形（CJK 异体字）或对接 TTS / 音译：

```ts
import { applyLyricLanguages } from "lyric-kit";

// 原地推断并填充各行的 language 属性
applyLyricLanguages(lines);
console.log(lines[0].language); // 例如: "ja"
```

### 播放同步与卡拉OK进度

```ts
import {
  findActiveLyricIndices,
  findLyricIndex,
  getWordSweepProgress,
} from "lyric-kit";

// 1. 单行快速查找当前激活行
const currentMs = 1500;
const lineIndex = findLyricIndex(lines, currentMs);

// 2. 多行和声/对唱重叠查找（返回当前时间所有活跃行下标）
const activeIndices = findActiveLyricIndices(lines, currentMs);

if (lineIndex !== -1) {
  const activeLine = lines[lineIndex];

  // 3. 计算每个字/音节的卡拉OK平滑染色进度 [0, 1]
  for (const word of activeLine.words) {
    const progress = getWordSweepProgress(word, activeLine.startTime, currentMs);
  }
}
```

---

## API 参考

### `parseLyric(input, options?)`

解析歌词并返回 `LyricResult`。

- **`input`**: `string | LyricInput`
  - `content`: 主歌词文本。
  - `format?`: 手动指定主歌词格式。
  - `translation?`: 翻译文本。
  - `translationFormat?`: 手动指定翻译格式。
  - `romaji?`: 罗马音文本。若包含逐字时间戳（如 QRC / KRC / TTML），会自动将音节对齐挂载至各词的 `word.romanWord`。
  - `romajiFormat?`: 手动指定罗马音格式。
  - `kana?`: 独立的振假名注音文本（可选，若主歌词未内嵌 `[kana: ...]` 标签时生效）。
- **`options`**: `ParseOptions`（可选）

#### `ParseOptions`

| 参数 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `format` | `LyricFormat` | 自动检测 | 手动指定格式（`lrc`、`ttml`、`qrc`、`krc`、`yrc`、`lys`、`srt`、`ass`）。 |
| `detectBackground` | `boolean` | `true` | 是否识别并分离括号内的和声与伴唱（标记为 `isBG`）。 |
| `extractMetadata` | `boolean` | `false` | 是否提取歌曲元数据（歌曲名、歌手、专辑、制作人员、偏移量等）。 |
| `cleanKangxi` | `boolean` | `false` | 是否将康熙部首及 CJK 兼容字符规范化为通用汉字。 |
| `applyOffset` | `boolean` | `false` | 是否自动将 `metadata.offset` 毫秒数累加至所有行和词的时间戳中（`newTime = originalTime + offset`）。 |
| `keepEmptyLines` | `boolean` | `false` | 是否保留纯空白文本行（间奏标记）。默认 `false` 过滤空行并截断前行；`true` 时完整保留供播放器处理间奏。 |
| `multiLineMode` | `"join" \| "bilingual"` | `"join"` | SRT 多行解析模式。`join` 用空格连接多行；`bilingual` 首行为原文，第二行为译文，第三行为音译。 |
| `preferredLang` | `string` | `""` | 多轨道 TTML 解析时优先匹配的翻译语言代码（如 `"zh-CN"`）。 |
| `domParser` | `DOMParserLike` | 自动 | 自定义 DOMParser 实例或构造函数（Node.js 等无原生 DOM 环境下解析 TTML / QRC 必填）。 |

### 独立格式解析器与序列化器

可直接导入各格式的专属解析与导出函数（统一采用全大写规范命名）：

```ts
import {
  parseLRC,
  parseTTML,
  parseQRC,
  parseKRC,
  parseYRC,
  parseLyS,
  parseSRT,
  parseASS,
  toLRC,
  toEnhancedLRC,
  toTTML,
  toSRT,
} from "lyric-kit";

// 解析
const result = parseLRC(lrcText, { cleanKangxi: true });

// 序列化
const ttmlXml = toTTML(result);
const lrcText = toLRC(result.lines);
```

### `detectFormat(text)`

分析原始文本特征并返回识别出的格式：
`"lrc" | "ttml" | "qrc" | "krc" | "yrc" | "lys" | "srt" | "ass"`。

### 数据模型

```ts
interface LyricResult {
  lines: LyricLine[];
  metadata: LyricMetadata;
}

interface LyricLine {
  id?: string;
  language?: "ja" | "ko" | "zh-CN" | "und-Latn";
  words: LyricWord[];
  translatedLyric: string;
  romanLyric: string;
  startTime: number; // 毫秒 (ms)
  endTime: number;   // 毫秒 (ms)
  isBG: boolean;
  isDuet: boolean;
  agentId?: string;
  songPart?: string;
  blockIndex?: number;
}

interface LyricWord {
  word: string;
  startTime: number; // 毫秒 (ms)
  endTime: number;   // 毫秒 (ms)
  romanWord?: string; // 逐字罗马音/拼音音译 (如 "kai", "zeoi")
  ruby?: LyricSpan[]; // 振假名/注音跨度数组 (如日文假名 "かい")
  obscene?: boolean;
  emptyBeat?: number;
}

interface LyricSpan {
  word: string;
  startTime: number; // 毫秒 (ms)
  endTime: number;   // 毫秒 (ms)
}
```

## 开源协议

[AGPL-3.0](LICENSE)
