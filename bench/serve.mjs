// Serve only the recorder's static assets; there is no upload endpoint.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const files = new Map([
  ["/", ["index.html","text/html; charset=utf-8"]],
  ...["capture.mjs","dsp.mjs","worklet.mjs"].map(name => ["/"+name,[name,"text/javascript; charset=utf-8"]]),
]);
const port = Number(process.argv[2] ?? 8765);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Choose port 1024–65535.");
const host = process.argv[3] ?? "127.0.0.1";
if (!["127.0.0.1","::1"].includes(host)) throw new Error("Loopback only.");
createServer(async (req,res) => {
  const found = files.get(req.url);
  if (req.method !== "GET" || !found) { res.writeHead(404).end(); return; }
  const [file,type] = found;
  try {
    const data = await readFile(new URL(file,import.meta.url));
    res.writeHead(200,{"Content-Type":type,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff",
      "Content-Security-Policy":"default-src 'self'; style-src 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"}).end(data);
  } catch { res.writeHead(500).end(); }
}).listen(port,host,() => console.log("Desk Sonar: http://localhost:"+port));