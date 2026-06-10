import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
const viteArgs = ["--host", "0.0.0.0", ...process.argv.slice(2)];

const api = spawn(process.execPath, [path.join(root, "server", "index.js")], {
  cwd: root,
  stdio: "inherit",
});

const vite = spawn(process.execPath, [viteBin, ...viteArgs], {
  cwd: root,
  stdio: "inherit",
});

function stop() {
  api.kill();
  vite.kill();
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

api.on("exit", (code) => {
  if (code) process.exit(code);
});

vite.on("exit", (code) => {
  if (code) process.exit(code);
});
