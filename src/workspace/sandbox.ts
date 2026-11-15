import path from "node:path";

export function resolveInWorkspace(
  workspaceRoot: string,
  targetPath: string
): string {
  const resolvedRoot = path.resolve(workspaceRoot);
  const resolvedTarget = path.resolve(resolvedRoot, targetPath);
  const relative = path.relative(resolvedRoot, resolvedTarget);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `Security Violation: Path "${targetPath}" escapes workspace boundary`
    );
  }

  return resolvedTarget;
}
