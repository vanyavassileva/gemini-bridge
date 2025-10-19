// api/gemini.js — CommonJS serverless handler with image support

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

  // Health
  if (req.method === "GET") {
    res.statusCode = 200;
    return res.end("Gemini bridge running");
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

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

    // Try to extract an inline image if Gemini returned one
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inline_data && p.inline_data.data);
    const textPart  = parts.find(p => typeof p.text === "string");

    if (imagePart?.inline_data?.data) {
      // Base64 data URL for easy rendering in chat
      const dataUrl = `data:${imagePart.inline_data.mime_type || "image/png"};base64,${imagePart.inline_data.data}`;
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 200;
      return res.end(JSON.stringify({ type: "image", image: dataUrl, raw: data }));
    }

    const text = parts.map(p => p.text || "").join("") || textPart?.text || "";
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    return res.end(JSON.stringify({ type: "text", text, raw: data }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: e?.message || "server_error" }));
  }
};
