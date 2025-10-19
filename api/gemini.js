export default async function handler(req, res) {
  // Allow all origins for testing (you can restrict later)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const MODEL = "gemini-2.0-flash";

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
  }

  // GET = health check
  if (req.method === "GET") {
    return res.status(200).send("Gemini bridge running");
  }

  // POST = send prompt to Gemini
  if (req.method === "POST") {
    try {
      const { prompt, temperature = 0.7 } = req.body || {};
      if (!prompt) {
        return res.status(400).json({ error: "Missing 'prompt'" });
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature },
        }),
      });

      const data = await response.json();
      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || "No text response";

      return res.status(200).json({ text });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
