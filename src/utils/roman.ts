import type { LyricWord } from "../types";

/** 单个主词可合并的最大罗马音音节数（防止过度合并） */
const MAX_ROMAN_MERGE = 4;

/** DP 得分参数 */
const SKIP_MAIN_PENALTY = -0.30;
const SKIP_ROMAN_PENALTY = -0.20;
const MERGE_PENALTY = 0.12;

/** 最小可接受匹配得分 */
const MIN_MATCH_SCORE = 0.20;

const NEG_INF = -1e9;

/** 计算两个时间区间的重叠时长 */
const getOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): number => {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
};

/** 词级时间相似度（0 ~ 1） */
const matchScore = (a: LyricWord, b: LyricWord): number => {
  const durA = Math.max(1, a.endTime - a.startTime);
  const durB = Math.max(1, b.endTime - b.startTime);

  const overlap = getOverlap(a.startTime, a.endTime, b.startTime, b.endTime);
  const overlapRatio = overlap / Math.min(durA, durB);

  const centerA = (a.startTime + a.endTime) / 2;
  const centerB = (b.startTime + b.endTime) / 2;
  const centerDiff = Math.abs(centerA - centerB);
  const centerSim = Math.max(0, 1 - centerDiff / Math.max(durA, durB));

  const durationSim = Math.min(durA, durB) / Math.max(durA, durB);

  return 0.7 * overlapRatio + 0.2 * centerSim + 0.1 * durationSim;
};

/** 把 words 中 [start, end) 区间的词虚拟合并为一个词（仅用于评分） */
const mergeWords = (words: LyricWord[], start: number, end: number): LyricWord => {
  const first = words[start];
  const last = words[end - 1];
  return {
    word: words.slice(start, end).map(w => w.word).join(""),
    startTime: first.startTime,
    endTime: last.endTime,
  };
};

/**
 * 将逐字罗马音/拼音音节高效对齐并挂载至主歌词单词列表（原地修改）
 *
 * 算法：带合并操作的动态规划（DP）
 * - 允许 1-1 匹配、跳过冗余、1 main 合并多个 roman
 * - 全局最优：可避免双指针一次错误决策导致后续全线错位
 * - 保留原契约：原地修改 mainWords，不改变数组长度
 */
export const alignRomanization = (mainWords: LyricWord[], romanWords: LyricWord[]): void => {
  if (mainWords.length === 0 || romanWords.length === 0) return;
  if (mainWords.length > 1 && romanWords.length === 1) return;

  const n = mainWords.length;
  const m = romanWords.length;

  // dp[i][j]：处理前 i 个 main 词和前 j 个 roman 词的最优得分
  const dp: Float64Array[] = Array.from({ length: n + 1 }, () => {
    const arr = new Float64Array(m + 1);
    arr.fill(NEG_INF);
    return arr;
  });

  // 回溯选择编码：
  // 0=未设; 1=skipMain; 2=skipRoman; 3=match1; 20+k = mergeRoman（k>=2）
  const choice: Int32Array[] = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));

  dp[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    dp[i][0] = dp[i - 1][0] + SKIP_MAIN_PENALTY;
    choice[i][0] = 1;
  }
  for (let j = 1; j <= m; j++) {
    dp[0][j] = dp[0][j - 1] + SKIP_ROMAN_PENALTY;
    choice[0][j] = 2;
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      let best = dp[i][j];
      let bestChoice = 0;

      // 1) skipMain
      {
        const score = dp[i - 1][j] + SKIP_MAIN_PENALTY;
        if (score > best) { best = score; bestChoice = 1; }
      }

      // 2) skipRoman
      {
        const score = dp[i][j - 1] + SKIP_ROMAN_PENALTY;
        if (score > best) { best = score; bestChoice = 2; }
      }

      // 3) 1-1
      {
        const s = matchScore(mainWords[i - 1], romanWords[j - 1]);
        if (s >= MIN_MATCH_SCORE) {
          const score = dp[i - 1][j - 1] + s;
          if (score > best) { best = score; bestChoice = 3; }
        }
      }

      // 4) 1 个 main 合并对应 k 个 roman（原实现的“多音节合并”场景）
      {
        const maxK = Math.min(MAX_ROMAN_MERGE, j);
        for (let k = 2; k <= maxK; k++) {
          const merged = mergeWords(romanWords, j - k, j);
          const s = matchScore(mainWords[i - 1], merged);
          if (s < MIN_MATCH_SCORE) continue;
          const score = dp[i - 1][j - k] + s - MERGE_PENALTY * (k - 1);
          if (score > best) { best = score; bestChoice = 20 + k; }
        }
      }

      dp[i][j] = best;
      choice[i][j] = bestChoice;
    }
  }

  // ---- 回溯 ----
  type Op =
    | { type: "skipMain"; mainIdx: number }
    | { type: "skipRoman" }
    | { type: "match1"; mainIdx: number; romanIdx: number }
    | { type: "mergeRoman"; mainIdx: number; romanStart: number; romanEnd: number };

  const ops: Op[] = [];
  let i = n, j = m;

  while (i > 0 || j > 0) {
    const c = choice[i][j];
    if (c === 1) {
      ops.push({ type: "skipMain", mainIdx: i - 1 });
      i--;
    } else if (c === 2) {
      ops.push({ type: "skipRoman" });
      j--;
    } else if (c === 3) {
      ops.push({ type: "match1", mainIdx: i - 1, romanIdx: j - 1 });
      i--; j--;
    } else if (c >= 20) {
      const k = c - 20;
      ops.push({ type: "mergeRoman", mainIdx: i - 1, romanStart: j - k, romanEnd: j });
      i--; j -= k;
    } else {
      // 兜底（不应发生）
      if (i > 0) i--; else j--;
    }
  }

  ops.reverse();

  // ---- 应用（原地修改） ----
  for (const mw of mainWords) {
    mw.romanWord = undefined;
  }

  // 每个 main 词收集的音节
  const syllablesByMain: string[][] = Array.from({ length: n }, () => []);

  for (const op of ops) {
    if (op.type === "match1") {
      const text = romanWords[op.romanIdx].word.trim();
      if (text) syllablesByMain[op.mainIdx].push(text);
    } else if (op.type === "mergeRoman") {
      // 1 个 main 对应多个 roman：把音节依次连接
      for (let k = op.romanStart; k < op.romanEnd; k++) {
        const text = romanWords[k].word.trim();
        if (text) syllablesByMain[op.mainIdx].push(text);
      }
    }
    // skipMain / skipRoman 不产生内容
  }

  for (let idx = 0; idx < n; idx++) {
    if (syllablesByMain[idx].length > 0) {
      mainWords[idx].romanWord = syllablesByMain[idx].join("");
    }
  }
};
