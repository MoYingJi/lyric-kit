// 先运行 pnpm build，再执行 node benchmarks/sync.mjs。
import { performance } from "node:perf_hooks";
import { createActiveLyricFinder, findActiveLyricIndices } from "../dist/index.mjs";

for (const count of [300, 5000]) {
  const lines = Array.from({ length: count }, (_, i) => ({
    startTime: i * 1000,
    endTime: i * 1000 + 1500,
    words: [],
    translatedLyric: "",
    romanLyric: "",
    isBG: false,
    isDuet: false,
  }));
  const times = Array.from({ length: 20000 }, (_, i) => (i * 7919) % (count * 1000));
  const start = performance.now();
  const indexed = createActiveLyricFinder(lines);
  const buildMs = performance.now() - start;
  const linear = (time) => findActiveLyricIndices(lines, time);
  const measure = (find) => {
    let checksum = 0;
    const start = performance.now();
    for (const time of times) {
      for (const index of find(time)) checksum += index;
    }
    return { ms: performance.now() - start, checksum };
  };
  measure(linear);
  measure(indexed);
  const baseline = [];
  const optimized = [];
  for (let sample = 0; sample < 5; sample++) {
    const before = measure(linear);
    const after = measure(indexed);
    if (before.checksum !== after.checksum) throw new Error("查询结果不一致");
    baseline.push(before.ms);
    optimized.push(after.ms);
  }
  const median = (values) => values.sort((a, b) => a - b)[2];
  console.log(
    JSON.stringify({
      lines: count,
      queries: times.length,
      buildMs,
      linearMs: median(baseline),
      indexedMs: median(optimized),
    }),
  );
}
