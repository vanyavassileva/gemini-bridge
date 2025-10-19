// api/gemini.js — Always use the newest Gemini model, supports /?status=1 check

async function readBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

// Detect the newest available model, preferring "flash" but falling back safely
async function getLatestModel(apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const r = await fetch(url);
  const data = await r.json();
  const models = data.models?.map(m => m.name.replace("models/", "")) || [];

  if (models.length === 0) return "gemini-2.0-flash";

  // Prefer "flash" models first
  const flashModels = models.filter(n => n.toLowerCase().includes("flash"));
  const pool = flashModels.length ? flashModels : models;

  // Sort numerically by version number (e.g., gemini-2.5 > gemini-2.0)
  pool.sort((a, b) => {
    const va = parseFloat(a.match(/(\d+\.\d+)/)?.[1] || "0");
    const vb = parseFloat(b.match(/(\d+\.\d+)/)?.[1] || "0");
    return vb - va;
  });

  return pool[0];
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

  // 🌿 Status check
  const url = new URL(req.url, "http://localhost");
  if (req.method === "GET" && url.searchParams.get("status")) {
    try {
      const model = await getLatestModel(GEMINI_API_KEY);
      return res.status(200).json({ status: "running", currentModel: model });
    } catch (e) {
      return res.status(500).json({ error: "Could not retrieve models", message: e.message });
    }
  }

  // Default health check
  if (req.method === "GET") {
    res.status(200).send("Gemini bridge running (auto-detect latest model)");
    return;
  }

  // POST = generate image
  try {
    const { prompt } = await readBody(req);
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const model = await getLatestModel(GEMINI_API_KEY);
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }]}],
        generationConfig: { responseMimeType: "image/png" }
      })
    });

    const data = await response.json();
    const imageData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!imageData)
      return res.status(500).json({ error: "No image data returned", modelUsed: model });

    res.status(200).json({
      modelUsed: model,
      image: `data:image/png;base64,${imageData}`
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
