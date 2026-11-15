import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveInWorkspace } from "../src/workspace/sandbox.js";

describe("resolveInWorkspace", () => {
  const root = path.resolve("test_workspace");

  it("should resolve valid relative paths inside workspace", () => {
    const target = "src/index.ts";
    const resolved = resolveInWorkspace(root, target);
    expect(resolved).toBe(path.join(root, "src", "index.ts"));
  });

  it("should resolve current directory", () => {
    const resolved = resolveInWorkspace(root, ".");
    expect(resolved).toBe(root);
  });

  it("should resolve absolute path that is inside workspace", () => {
    const target = path.join(root, "inner", "file.txt");
    const resolved = resolveInWorkspace(root, target);
    expect(resolved).toBe(target);
  });

  it("should throw error when path escapes workspace with parent navigation", () => {
    expect(() => resolveInWorkspace(root, "../outside.txt")).toThrowError(
      'Security Violation: Path "../outside.txt" escapes workspace boundary'
    );
  });

  it("should throw error when deep traversal escapes workspace", () => {
    expect(() =>
      resolveInWorkspace(root, "sub/../../escaped.txt")
    ).toThrowError("Security Violation");
  });

  it("should throw error when absolute path is outside workspace", () => {
    const outside = path.resolve("other_root", "secret.env");
    expect(() => resolveInWorkspace(root, outside)).toThrowError(
      "Security Violation"
    );
  });
});
