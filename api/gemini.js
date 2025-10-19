import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, model = "gemini-2.0-flash", type = "image" } = req.body;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    });

    const data = await response.json();

    // Extract base64 image data or fallback to text
    const imageData =
      data?.candidates?.[0]?.content?.parts?.find((p) => p.inline_data)?.inline_data?.data;

    const textResponse =
      data?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;

    if (imageData) {
      res.status(200).json({ type: "image", image: `data:image/png;base64,${imageData}` });
    } else {
      res.status(200).json({ type: "text", text: textResponse });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
}
