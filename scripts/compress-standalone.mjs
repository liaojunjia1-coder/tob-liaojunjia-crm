import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.join(root, "dist", "crm-standalone.html");
const outputPath = path.join(root, "dist", "crm-edgeone.html");
const source = await fs.readFile(inputPath, "utf8");
const payload = gzipSync(Buffer.from(source, "utf8"), { level: 9 }).toString("base64");

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#17745a" />
    <title>tob Liaojunjia CRM</title>
    <style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f7f6;color:#14221d}
      main{width:min(88vw,360px);text-align:center}
      .mark{width:56px;height:56px;margin:0 auto 18px;border-radius:16px;background:#14221d;color:#fff;display:grid;place-items:center;font-weight:800}
      p{line-height:1.7;color:#66736e}
    </style>
  </head>
  <body>
    <main>
      <div class="mark">LJ</div>
      <h1>Opening CRM</h1>
      <p>The first load may take a few seconds.</p>
    </main>
    <script type="module">
      const payload = "${payload}";
      const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
      if (!("DecompressionStream" in window)) {
        document.querySelector("p").textContent = "Please open this link with the latest Safari or WeChat.";
      } else {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
        const html = await new Response(stream).text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        document.head.replaceChildren(...doc.head.childNodes);
        document.body.replaceChildren(...doc.body.childNodes);
        for (const oldScript of [...document.querySelectorAll("script")]) {
          const script = document.createElement("script");
          for (const attr of oldScript.attributes) script.setAttribute(attr.name, attr.value);
          script.textContent = oldScript.textContent;
          oldScript.replaceWith(script);
        }
      }
    </script>
  </body>
</html>
`;

await fs.writeFile(outputPath, html, "utf8");
console.log(`Wrote ${outputPath}`);
