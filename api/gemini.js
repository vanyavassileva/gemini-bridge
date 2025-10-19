import http from "http";
import { StringDecoder } from "string_decoder";
import fetch from "node-fetch";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.0-flash";

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.end();

  if (req.method === "POST" && req.url === "/gemini/generate") {
    try {
      const decoder = new StringDecoder("utf8");
      let body = "";
      req.on("data", chunk => (body += decoder.write(chunk)));
      req.on("end", async () => {
        decoder.end();
        const { prompt } = JSON.parse(body);
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }]}],
            }),
          }
        );
        const data = await r.json();
        const text =
          data?.candidates?.[0]?.content?.parts
            ?.map((p) => p.text || "")
            .join("") || "";
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ text }));
      });
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
  } else {
    res.writeHead(200);
    res.end("Gemini bridge running");
  }
});

server.listen(3000);
