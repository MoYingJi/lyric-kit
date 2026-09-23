import { describe, expect, it } from "vitest";
import { extractLyricAuthors } from "../src/clean/author";
import { defaultAuthors } from "../src/clean/excludeRules";

describe("extractLyricAuthors", () => {
  describe("TTML 格式", () => {
    it("应优先提取 ttmlAuthorGithubLogin", () => {
      const content = `
        <metadata>
          <ttm:agent type="person">
            <ttm:name key="ttmlAuthorGithubLogin" value="octocat" />
            <ttm:name key="ttmlAuthorGithub" value="https://github.com/octocat-profile" />
          </ttm:agent>
        </metadata>
      `;
      expect(extractLyricAuthors(content, "ttml")).toEqual(["octocat"]);
    });

    it("若无 login，则从 ttmlAuthorGithub 链接中解析用户名", () => {
      const content = `
        <metadata>
          <ttm:agent type="person">
            <ttm:name key="ttmlAuthorGithub" value="https://github.com/someone" />
          </ttm:agent>
        </metadata>
      `;
      expect(extractLyricAuthors(content, "ttml")).toEqual(["someone"]);
    });

    it("支持多作者并自动去重", () => {
      const content = `
        <metadata>
          <ttm:name key="ttmlAuthorGithubLogin" value="user1" />
          <ttm:name key="ttmlAuthorGithubLogin" value="user2" />
          <ttm:name key="ttmlAuthorGithubLogin" value="user1" />
        </metadata>
      `;
      expect(extractLyricAuthors(content, "ttml")).toEqual(["user1", "user2"]);
    });

    it("TTML 中若作者包含被排除关键词应自动过滤", () => {
      const content = `
        <metadata>
          <ttm:name key="ttmlAuthorGithubLogin" value="AI生成字幕" />
          <ttm:name key="ttmlAuthorGithubLogin" value="real_user" />
        </metadata>
      `;
      expect(extractLyricAuthors(content, "ttml")).toEqual(["real_user"]);
    });
  });

  describe("基于 [by:...] 标签的歌词格式（LRC, QRC, KRC, YRC, LYS）", () => {
    it("应正常提取 LRC 中的真实作者", () => {
      const lrc = "[ti:晴天]\n[ar:周杰伦]\n[by:方文山粉丝]\n[00:01.00]故事的小黄花";
      expect(extractLyricAuthors(lrc, "lrc")).toEqual(["方文山粉丝"]);
    });

    it("应支持 QRC, KRC, YRC, LYS 中的 [by:...] 提取", () => {
      const qrc = "[ti:Test]\n[by:QrcMaker]\n[0,1000]歌词";
      expect(extractLyricAuthors(qrc, "qrc")).toEqual(["QrcMaker"]);

      const krc = "[ti:Test]\n[by:KrcMaker]\n[0,1000]歌词";
      expect(extractLyricAuthors(krc, "krc")).toEqual(["KrcMaker"]);

      const yrc = "[ti:Test]\n[by:YrcMaker]\n[0,1000]歌词";
      expect(extractLyricAuthors(yrc, "yrc")).toEqual(["YrcMaker"]);

      const lys = "[ti:Test]\n[by:LysMaker]\n[0,1000]歌词";
      expect(extractLyricAuthors(lys, "lys")).toEqual(["LysMaker"]);
    });

    it("应自动排除默认的机器人与工具关键词（大小写不敏感）", () => {
      expect(defaultAuthors).toContain("QQ音乐动态歌词");
      expect(defaultAuthors).toContain("krc转qrc工具");
      expect(defaultAuthors).toContain("AI智能字幕");
      expect(defaultAuthors).toContain("AI生成");

      expect(extractLyricAuthors("[by:QQ音乐动态歌词]", "lrc")).toEqual([]);
      expect(extractLyricAuthors("[by:krc转qrc工具]", "lrc")).toEqual([]);
      expect(extractLyricAuthors("[by:AI智能字幕]", "lrc")).toEqual([]);
      expect(extractLyricAuthors("[by:AI生成]", "lrc")).toEqual([]);

      // 大小写变体与包含关系
      expect(extractLyricAuthors("[by:KRC转QRC工具v2]", "lrc")).toEqual([]);
      expect(extractLyricAuthors("[by:Krc转Qrc工具]", "lrc")).toEqual([]);
      expect(extractLyricAuthors("[by:本行由ai生成制作]", "lrc")).toEqual([]);
      expect(extractLyricAuthors("[by:ai智能字幕]", "lrc")).toEqual([]);
    });

    it("支持通过参数追加自定义排除关键词", () => {
      const lrc = "[by:自定义机器人01]";
      expect(extractLyricAuthors(lrc, "lrc")).toEqual(["自定义机器人01"]);
      expect(extractLyricAuthors(lrc, "lrc", ["自定义机器人"])).toEqual([]);
    });

    it("当不存在 [by:...] 标签时应返回空数组", () => {
      const lrc = "[ti:晴天]\n[ar:周杰伦]\n[00:01.00]故事的小黄花";
      expect(extractLyricAuthors(lrc, "lrc")).toEqual([]);
    });
  });

  describe("其他格式", () => {
    it("SRT 和 ASS 格式暂无 by 提取规则，应返回空数组", () => {
      expect(extractLyricAuthors("1\n00:00:01,000 --> 00:00:02,000\nHello", "srt")).toEqual([]);
      expect(
        extractLyricAuthors(
          "[Events]\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello",
          "ass",
        ),
      ).toEqual([]);
    });
  });
});
