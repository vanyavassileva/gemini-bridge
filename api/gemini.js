// trigger redeploy
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body;

    const model = "gemini-2.0-flash";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "image/png",  // 👈 THIS makes Gemini return an image
        },
      }),
    });

    const data = await response.json();

    // Extract base64 image
    const imageData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!imageData) {
      return res.status(500).json({ error: "No image data returned from Gemini", raw: data });
    }

    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ image: `data:image/png;base64,${imageData}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
