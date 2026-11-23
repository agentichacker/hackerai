import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const workspaceRoot = process.cwd();
const targets = new Set(["node_modules", ".vite-plus"]);

for (const group of ["apps", "packages"]) {
  const groupPath = NodePath.join(workspaceRoot, group);
  if (!NodeFS.existsSync(groupPath)) continue;
  for (const entry of NodeFS.readdirSync(groupPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const name of ["node_modules", "dist", "dist-electron", ".vite-plus"]) {
      targets.add(NodePath.join(group, entry.name, name));
    }
  }
}

let removed = 0;
for (const target of targets) {
  const absolutePath = NodePath.join(workspaceRoot, target);
  if (!NodeFS.existsSync(absolutePath)) continue;
  NodeFS.rmSync(absolutePath, { recursive: true, force: true });
  removed += 1;
  console.log(`removed ${target}`);
}
console.log(`clean complete (${removed} path${removed === 1 ? "" : "s"})`);
