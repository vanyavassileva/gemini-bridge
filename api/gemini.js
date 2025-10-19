// api/gemini.js — Image-only Gemini bridge

async function readBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }

  // Health check
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
      return res.end(JSON.stringify({ error: "Missing prompt" }));
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

    // Extract image only
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inline_data?.data);

    if (!imagePart) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: "No image generated" }));
    }

    const dataUrl = `data:${imagePart.inline_data.mime_type || "image/png"};base64,${imagePart.inline_data.data}`;
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(JSON.stringify({ image: dataUrl }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message || "server_error" }));
  }
};
