import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFsTools } from "../src/tools/fs.js";

describe("createFsTools", () => {
  const testRoot = path.resolve("temp_test_fs_workspace");
  const [readFileTool, writeFileTool, listDirectoryTool] =
    createFsTools(testRoot);

  beforeAll(async () => {
    await fs.mkdir(testRoot, { recursive: true });
    await fs.writeFile(
      path.join(testRoot, "sample.txt"),
      "hello world",
      "utf-8"
    );
    await fs.mkdir(path.join(testRoot, "sub_dir"), { recursive: true });
    await fs.writeFile(
      path.join(testRoot, "sub_dir", "nested.txt"),
      "nested content",
      "utf-8"
    );
  });

  afterAll(async () => {
    await fs.rm(testRoot, { recursive: true, force: true });
  });

  describe("read_file", () => {
    it("正确读取工作区内存在的文件", async () => {
      const res = await readFileTool.execute({ path: "sample.txt" });
      expect(res).toBe("hello world");
    });

    it("路径为空或非字符串时返回参数校验错误", async () => {
      const res1 = await readFileTool.execute({});
      const res2 = await readFileTool.execute({ path: "   " });
      expect(res1).toBe("Error: path 参数必须是非空字符串");
      expect(res2).toBe("Error: path 参数必须是非空字符串");
    });

    it("读取不存在的文件时返回自愈引导提示", async () => {
      const res = await readFileTool.execute({ path: "non_existent.txt" });
      expect(res).toContain('Error: File "non_existent.txt" does not exist');
    });

    it("试图读取目录时提示换用 list_directory", async () => {
      const res = await readFileTool.execute({ path: "sub_dir" });
      expect(res).toContain("is a directory, not a file. Use list_directory");
    });

    it("越界读取时拦截并返回安全错误", async () => {
      const res = await readFileTool.execute({ path: "../outside.txt" });
      expect(res).toContain("Security Error: Access denied.");
    });

    it("内容超过 50000 字符时执行截断", async () => {
      const hugePath = path.join(testRoot, "huge.txt");
      await fs.writeFile(hugePath, "x".repeat(55000), "utf-8");
      const res = await readFileTool.execute({ path: "huge.txt" });
      expect(res.length).toBeLessThan(55000);
      expect(res).toContain("...[文件过长已截断]");
    });
  });

  describe("write_file", () => {
    it("成功创建或覆盖文件", async () => {
      const res = await writeFileTool.execute({
        path: "created.txt",
        content: "file content",
      });
      expect(res).toBe("成功写入文件: created.txt");

      const readBack = await fs.readFile(
        path.join(testRoot, "created.txt"),
        "utf-8"
      );
      expect(readBack).toBe("file content");
    });

    it("当父目录不存在时自动递归创建", async () => {
      const res = await writeFileTool.execute({
        path: "deep/nested/dir/test.txt",
        content: "nested file",
      });
      expect(res).toBe("成功写入文件: deep/nested/dir/test.txt");

      const readBack = await fs.readFile(
        path.join(testRoot, "deep/nested/dir/test.txt"),
        "utf-8"
      );
      expect(readBack).toBe("nested file");
    });

    it("参数不合法时返回错误信息", async () => {
      const res1 = await writeFileTool.execute({ content: "test" });
      const res2 = await writeFileTool.execute({ path: "a.txt" });
      expect(res1).toBe("Error: path 参数必须是非空字符串");
      expect(res2).toBe("Error: content 参数必须是字符串");
    });

    it("越界写入时拦截并拒绝", async () => {
      const res = await writeFileTool.execute({
        path: "../danger.txt",
        content: "bad",
      });
      expect(res).toContain("Security Error: Access denied.");
    });
  });

  describe("list_directory", () => {
    it("默认列出根目录下的文件与目录项", async () => {
      const res = await listDirectoryTool.execute({});
      expect(res).toContain("[FILE] sample.txt");
      expect(res).toContain("[DIR]  sub_dir");
    });

    it("列出指定子目录内容", async () => {
      const res = await listDirectoryTool.execute({ path: "sub_dir" });
      expect(res).toContain("[FILE] nested.txt");
    });

    it("列出空目录时返回提示", async () => {
      await fs.mkdir(path.join(testRoot, "empty_dir"), { recursive: true });
      const res = await listDirectoryTool.execute({ path: "empty_dir" });
      expect(res).toBe("目录为空。");
    });

    it("目录不存在时返回自愈提示", async () => {
      const res = await listDirectoryTool.execute({ path: "missing_dir" });
      expect(res).toContain('Error: Directory "missing_dir" does not exist.');
    });

    it("目标是文件而非目录时提示换用 read_file", async () => {
      const res = await listDirectoryTool.execute({ path: "sample.txt" });
      expect(res).toContain("is a file, not a directory. Use read_file");
    });

    it("越界探索目录时拦截并返回安全错误", async () => {
      const res = await listDirectoryTool.execute({ path: "../../" });
      expect(res).toContain("Security Error: Access denied.");
    });
  });
});
