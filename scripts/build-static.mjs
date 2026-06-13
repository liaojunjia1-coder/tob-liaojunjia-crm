import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
const result = spawnSync(process.execPath, [viteBin, "build"], {
  cwd: root,
  env: {
    ...process.env,
    VITE_STATIC_LOCAL_MODE: "true",
  },
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
