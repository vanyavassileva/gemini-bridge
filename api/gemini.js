// api/gemini.js — CommonJS serverless handler for Vercel (no http.listen)

// Read raw JSON body (Vercel doesn't auto-parse here)
async function readBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

module.exports = async (req, res) => {
  // CORS + preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }

  // Simple health check
  if (req.method === "GET") {
    res.statusCode = 200;
    return res.end("Gemini bridge running");
  }

  // Only POST handles prompts
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  // Validate env
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: "Missing GEMINI_API_KEY" }));
  }

  try {
    const { prompt, temperature = 0.7, model = "gemini-2.0-flash" } = await readBody(req);
    if (!prompt) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Missing 'prompt' in body" }));
    }

    // Use global fetch on Vercel (no import needed)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${GEMINI_API_KEY}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: String(prompt) }]}],
        generationConfig: { temperature }
      })
    });

    const data = await r.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map(p => p.text || "").join("");

    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    return res.end(JSON.stringify({ type: "text", text, raw: data }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: e?.message || "server_error" }));
  }
};
