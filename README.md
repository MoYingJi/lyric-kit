# lyric-kit

A high-performance TypeScript library for parsing, serializing, and synchronizing lyrics across multiple formats (LRC, TTML, QRC, KRC, YRC, LyS, SRT, ASS).

[![npm version](https://img.shields.io/npm/v/lyric-kit.svg?color=3399ff)](https://www.npmjs.com/package/lyric-kit)
[![npm downloads](https://img.shields.io/npm/dm/lyric-kit.svg)](https://www.npmjs.com/package/lyric-kit)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](#)
[![Zero Dependency](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#)

English | [简体中文](README.zh-CN.md)

## Installation

```bash
pnpm add lyric-kit
# or
npm install lyric-kit
```

## Quick Start

### Parse Lyrics

`parseLyric` accepts raw lyric text or an object payload with optional translations/romanizations.

```ts
import { parseLyric } from "lyric-kit";

// 1. Parse string (format auto-detected)
const { lines, metadata } = parseLyric(`
[ti:Song Title]
[ar:Artist Name]
[00:01.00]First line
[00:03.00]Second line
`);

// 2. Parse with translation & romanization alignment
const result = parseLyric({
  content: "[00:01.00]Hello\n[00:03.00]Goodbye",
  translation: "[00:01.00]你好\n[00:03.00]再见",
  romaji: "[00:01.00]haro\n[00:03.00]gubbai",
});
```

### Serialize Lyrics

Export via dedicated serializer functions or the unified `serializeLyric` entry:

```ts
import { toEnhancedLRC, toLRC, toSRT, toTTML } from "lyric-kit";

// Standard line-by-line LRC
const lrc = toLRC(lines);

// Word-by-word enhanced LRC
const elrc = toEnhancedLRC(lines);

// Apple Music TTML XML (accepts lines array or LyricResult with metadata)
const ttml = toTTML(result);

// SubRip subtitle
const srt = toSRT(lines);

// Or via unified serializeLyric entry:
import { serializeLyric } from "lyric-kit";
const output = serializeLyric(lines, "ttml");
```

### Clean Metadata Headers

Strip credit headers/footers (lyricist, composer, arranger, copyright notices):

```ts
import { stripLyricMetadata } from "lyric-kit";

const cleanedLines = stripLyricMetadata(lines, {
  matchMetadata: {
    title: "Song Title",
    artists: ["Artist Name"],
  },
});
```

### Infer Lyric Language

Automatically infers and assigns language codes (`ja` / `ko` / `zh-CN` / `und-Latn`) using kana furigana (ruby), full-song translation cues, and CJK script density ratios. This helps UI layers select localized CJK glyphs or wire up TTS / pronunciation tools:

```ts
import { applyLyricLanguages } from "lyric-kit";

// In-place language inference on each line
applyLyricLanguages(lines);
console.log(lines[0].language); // e.g., "ja"
```

### Playback Synchronization

```ts
import {
  findActiveLyricIndices,
  findLyricIndex,
  getWordSweepProgress,
} from "lyric-kit";

// 1. Single-line quick lookup
const currentMs = 1500;
const lineIndex = findLyricIndex(lines, currentMs);

// 2. Multi-line overlap lookup (returns all active line indices at currentMs)
const activeIndices = findActiveLyricIndices(lines, currentMs);

if (lineIndex !== -1) {
  const activeLine = lines[lineIndex];

  // 3. Calculate smooth karaoke sweep progress [0, 1] per syllable/word
  for (const word of activeLine.words) {
    const progress = getWordSweepProgress(word, activeLine.startTime, currentMs);
  }
}
```

---

## API Reference

### `parseLyric(input, options?)`

Parses lyrics and returns a `LyricResult`.

- **`input`**: `string | LyricInput`
  - `content`: Primary lyric string.
  - `format?`: Optional format override.
  - `translation?`: Optional translation string.
  - `translationFormat?`: Optional translation format override.
  - `romaji?`: Optional romanization string. When word-timed (QRC / KRC / TTML), automatically aligns syllables to `word.romanWord`.
  - `romajiFormat?`: Optional romanization format override.
  - `kana?`: Optional standalone furigana kana string (used if not embedded via `[kana: ...]`).
- **`options`**: `ParseOptions` (optional)

#### `ParseOptions`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `format` | `LyricFormat` | auto | Explicit format override (`lrc`, `ttml`, `qrc`, `krc`, `yrc`, `lys`, `srt`, `ass`). |
| `detectBackground` | `boolean` | `true` | Detect and split parenthesized background/harmony vocals. |
| `extractMetadata` | `boolean` | `false` | Extract song metadata (title, artist, album, creators, offset). |
| `cleanKangxi` | `boolean` | `false` | Normalize KangXi radicals and CJK compatibility ideographs to standard characters. |
| `applyOffset` | `boolean` | `false` | Automatically apply `metadata.offset` ms to all lines and words (`newTime = originalTime + offset`). |
| `keepEmptyLines` | `boolean` | `false` | Keep empty lines (interlude markers). Defaults to `false` (strips empty lines after clamping previous line); `true` preserves them for player interlude handling. |
| `multiLineMode` | `"join" \| "bilingual"` | `"join"` | SRT multi-line parsing mode. `join` joins lines with space; `bilingual` maps lines to primary, translation, romanization. |
| `preferredLang` | `string` | `""` | Preferred translation language code for multi-track TTML (e.g. `"zh-CN"`). |
| `domParser` | `DOMParserLike` | auto | Custom DOMParser instance/constructor (required in non-browser/Node.js environments when parsing TTML or QRC XML). |

### Format Parsers & Serializers

Dedicated parsers and serializers for each format can be called directly (unified uppercase standard naming):

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

// Parsing
const result = parseLRC(lrcText, { cleanKangxi: true });

// Serialization
const ttmlXml = toTTML(result);
const lrcText = toLRC(result.lines);
```

### `detectFormat(text)`

Inspects raw text patterns and returns the detected format:
`"lrc" | "ttml" | "qrc" | "krc" | "yrc" | "lys" | "srt" | "ass"`.

### Data Models

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
  startTime: number; // ms
  endTime: number;   // ms
  isBG: boolean;
  isDuet: boolean;
  agentId?: string;
  songPart?: string;
  blockIndex?: number;
}

interface LyricWord {
  word: string;
  startTime: number; // ms
  endTime: number;   // ms
  romanWord?: string; // Per-word romanization/pinyin syllable (e.g. "kai", "zeoi")
  ruby?: LyricSpan[]; // Furigana/ruby spans (e.g. Japanese kana "かい")
  obscene?: boolean;
  emptyBeat?: number;
}

interface LyricSpan {
  word: string;
  startTime: number; // ms
  endTime: number;   // ms
}
```

## License

[AGPL-3.0](LICENSE)
