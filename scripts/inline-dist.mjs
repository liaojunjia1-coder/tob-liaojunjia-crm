import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const indexPath = path.join(distDir, "index.html");
const outputPath = path.join(distDir, "crm-standalone.html");

function assetPath(src) {
  return path.join(distDir, src.replace(/^\//, ""));
}

let html = await fs.readFile(indexPath, "utf8");

html = html
  .replace(/\s*<link rel="manifest"[^>]*>\n?/g, "")
  .replace(/\s*<link rel="icon"[^>]*>\n?/g, "")
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>\n?/g, "");

html = await replaceAsync(html, /<link rel="stylesheet" crossorigin href="([^"]+)">/g, async (_match, href) => {
  const css = await fs.readFile(assetPath(href), "utf8");
  return `<style>\n${css}\n</style>`;
});

html = await replaceAsync(html, /<script type="module" crossorigin src="([^"]+)"><\/script>/g, async (_match, src) => {
  const js = await fs.readFile(assetPath(src), "utf8");
  return `<script type="module">\n${js}\n</script>`;
});

await fs.writeFile(outputPath, html, "utf8");
console.log(`Wrote ${outputPath}`);

async function replaceAsync(source, pattern, replacer) {
  const matches = [...source.matchAll(pattern)];
  let next = "";
  let lastIndex = 0;
  for (const match of matches) {
    next += source.slice(lastIndex, match.index);
    next += await replacer(...match);
    lastIndex = match.index + match[0].length;
  }
  return next + source.slice(lastIndex);
}
