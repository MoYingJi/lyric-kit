#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import * as process from "node:process";

const targets = [{ filePath: "src/clean/excludeRules.ts", arrayName: "defaultKeywords" }] as const;

const sortExportedConstArray = (
  targetFile: fs.PathLike,
  arrayName: string,
  mode: "check" | "write",
) => {
  if (!fs.existsSync(targetFile)) {
    console.error("❌ 找不到文件", targetFile);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(targetFile, "utf-8");
  const keywordsMatch = matchArrayByName(fileContent, arrayName);
  if (!keywordsMatch) {
    console.error(`❌ 找不到 \`export const ${arrayName} = [...]\` 结构`);
    process.exit(1);
  }

  const [fullMatch, prefix, rawContent, suffix] = keywordsMatch;

  const rawItems = arrayRawContentToArray(rawContent);
  console.log(`✅ 找到 ${rawItems.length} 个关键词`);

  const uniqueItems = uniqueArray(rawItems, normalizeKw);
  console.log(
    `🧹 去重完毕，关键词有 ${uniqueItems.length} 个，移除了 ${rawItems.length - uniqueItems.length} 个`,
  );

  const collator = new Intl.Collator("zh-Hans-CN", { sensitivity: "accent" });
  uniqueItems.sort((a, b) => collator.compare(a, b));

  const newArrayContent = uniqueItems.map((item) => `  "${item}",`).join("\n");
  const newContentBlock = `\n${newArrayContent}\n`;
  const newFileContent = fileContent.replace(fullMatch, `${prefix}${newContentBlock}${suffix}`);

  if (newFileContent === fileContent) {
    console.log(`✅ ${arrayName} 数组已排序且无重复项，无需修改`);
    process.exit(0);
  }

  switch (mode) {
    case "write": {
      fs.writeFileSync(targetFile, newFileContent, "utf-8");
      console.log(`✅ ${arrayName} 数组已排序并去重`);
      break;
    }
    case "check": {
      console.error(`❌ ${arrayName} 数组未排序或存在重复项`);
      process.exit(1);
    }
  }
};

// 与 stripper.ts 中的 normalizeKw 保持一致
const normalizeKw = (str: string): string =>
  str.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const matchArrayByName = (fileContent: string, name: string): RegExpMatchArray | null => {
  const escaped = escapeRegExp(name);
  const re = new RegExp(
    `(export\\s+const\\s+${escaped}\\s*(?::\\s*(?:readonly\\s+)?string\\[\\]\\s*)?=\\s*\\[)([\\s\\S]*?)(\\];)`,
  );
  return fileContent.match(re);
};

const arrayRawContentToArray = (rawContent: string): string[] => {
  const itemRegex = /(['"`])(.*?)\1/g;
  const rawItems: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(rawContent)) !== null) {
    const content = match[2].trim();
    if (content) {
      rawItems.push(content);
    }
  }

  return rawItems;
};

const uniqueArray = (array: string[], normalize: (str: string) => string): string[] => {
  const uniqueMap = new Map<string, string>();

  for (const item of array) {
    const fingerprint = normalize(item);
    const existing = uniqueMap.get(fingerprint);

    if (existing !== undefined) {
      if (item.length > existing.length) {
        uniqueMap.set(fingerprint, item);
      }
    } else {
      uniqueMap.set(fingerprint, item);
    }
  }

  return Array.from(uniqueMap.values());
};

function showHelp() {
  console.error("❌ 参数错误，使用方法: node sort-keywords.ts <check|write>");
}

const args = process.argv.slice(2);

if (args.length !== 1) {
  showHelp();
  process.exit(1);
}

const mode = args[0];

if (mode !== "check" && mode !== "write") {
  showHelp();
  process.exit(1);
}

for (const { filePath, arrayName } of targets) {
  const targetFile = path.resolve(process.cwd(), filePath);
  sortExportedConstArray(targetFile, arrayName, mode);
}
