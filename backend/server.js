require('dotenv').config({ path: './backend/.env' });
console.log("Using Key:", process.env.GEMINI_API_KEY ? "YES" : "NO");
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.static('frontend'));
app.use(cors());
// Increased limit to handle base64 image uploads
app.use(express.json({ limit: '50mb' }));

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── TEXT CHAT ROUTE ─────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
    try {
        const { message, image } = req.body;
        console.log("1. Frontend sent text:", message);
        if (image) console.log("   [+] Received image attachment");

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: "You are AUЯA, a premium AI fashion stylist. You HAVE the ability to visualize outfits — the user's app has a dedicated Visualize button that triggers the imaging engine. When the user clicks visualize or asks for an image, say 'I am rendering your new look now...' and describe the outfit. Give 3 distinct outfit suggestions. Use short sentences and bullet points. Do not write more than 100 words. Format your response with clear paragraph breaks. If the user provides an image, analyze their clothing and give tailored advice. NEVER say you cannot generate images."
        });

        const parts = [{ text: message || "What do you think of this?" }];

        if (image) {
            const mimeTypeMatch = image.match(/data:(.*?);base64/);
            const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";
            const base64Data = image.split(',')[1] || image;
            parts.push({
                inlineData: { data: base64Data, mimeType: mimeType }
            });
        }

        const result = await model.generateContent(parts);
        const replyText = result.response.text();

        console.log("2. AUЯA generated:", replyText);
        res.json({ reply: replyText });

    } catch (error) {
        console.error("CRITICAL BACKEND ERROR:", error);
        res.status(500).json({ reply: "System glitch. My core is temporarily offline." });
    }
});

// ── IMAGE-TO-IMAGE VIRTUAL TRY-ON ROUTE ─────────────────────────────
app.post('/api/visualize-tryon', async (req, res) => {
    try {
        const { prompt, image } = req.body;
        console.log("1. Virtual Try-On request received");
        console.log("   Outfit:", prompt?.substring(0, 80) + "...");
        console.log("   Photo attached:", image ? "YES" : "NO");

        const tryOnPrompt = `You are an AI tailor. Redraw this exact user in this exact photo, but replace their clothing with: ${prompt}. Keep the face and background 100% identical. Style: Photorealistic, high-end fashion photography, natural lighting.`;

        // ── PRIMARY: Gemini 2.0 Flash native image generation ──
        // This model supports responseModalities: ["IMAGE", "TEXT"]
        // which enables true image-to-image transformation
        try {
            const imageModel = genAI.getGenerativeModel({
                model: "gemini-2.0-flash-exp",
                generationConfig: {
                    responseModalities: ["IMAGE", "TEXT"]
                }
            });

            const parts = [{ text: tryOnPrompt }];

            // Pass the user's original photo as the seed image
            if (image) {
                const mimeTypeMatch = image.match(/data:(.*?);base64/);
                const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";
                const base64Data = image.split(',')[1] || image;
                parts.push({
                    inlineData: { data: base64Data, mimeType: mimeType }
                });
            }

            const result = await imageModel.generateContent(parts);
            const responseParts = result.response.candidates[0].content.parts;

            // Extract the generated image from the response
            for (const part of responseParts) {
                if (part.inlineData) {
                    const generatedBase64 = part.inlineData.data;
                    const generatedMime = part.inlineData.mimeType || "image/png";
                    const imageUrl = `data:${generatedMime};base64,${generatedBase64}`;
                    console.log("   [+] Successfully generated via Gemini 2.0 Flash Image-to-Image");
                    return res.json({ imageUrl });
                }
            }

            // If no image part was found, throw to fallback
            throw new Error("No image in Gemini response");

        } catch (geminiError) {
            console.log("   [!] Gemini image gen failed:", geminiError.message);
            console.log("   [→] Falling back to Pollinations AI engine...");

            // ── FALLBACK: Pollinations text-to-image ──
            const fallbackPrompt = `Photorealistic fashion photography, person wearing: ${prompt}, studio lighting, high-end fashion catalog, detailed clothing textures, full body shot`;
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fallbackPrompt)}?width=1024&height=1024&nologo=true`;
            return res.json({ imageUrl });
        }

    } catch (error) {
        console.error("Image Gen Error:", error);
        res.status(500).json({ error: "Grid interference detected." });
    }
});

// ── BIOMETRIC SCAN ROUTE (for 3D Fitting Room) ──────────────────────
app.post('/api/generate-biometrics', async (req, res) => {
    try {
        const { image } = req.body;
        console.log("1. Biometric scan request received");

        if (!image) {
            return res.status(400).json({ error: "No image provided" });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const mimeTypeMatch = image.match(/data:(.*?);base64/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";
        const base64Data = image.split(',')[1] || image;

        const prompt = `Analyze this person. Return a JSON with these ratios relative to a standard human:
{
  "shoulder_width": <float e.g. 1.1 for broad, 0.9 for narrow>,
  "chest_depth": <float e.g. 1.05>,
  "waist_circumference": <float e.g. 1.0>,
  "leg_taper": <float e.g. 0.9 for tapered legs>,
  "skin_tone_hex": "<hex color code of their skin tone, e.g. #c68642>"
}
Use 1.0 as the base for a standard body. Do not include any text before or after the JSON. Only output the JSON object.`;

        const result = await model.generateContent([
            { text: prompt },
            { inlineData: { data: base64Data, mimeType: mimeType } }
        ]);

        const responseText = result.response.text().trim();
        console.log("2. Gemini biometric response:", responseText);

        // Parse JSON from response (handle potential markdown wrapping)
        let jsonStr = responseText;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];

        const biometrics = JSON.parse(jsonStr);
        console.log("3. Parsed biometrics:", biometrics);

        res.json({ biometrics });

    } catch (error) {
        console.error("Biometric scan error:", error);
        res.status(500).json({ error: "Biometric scan failed", biometrics: { shoulder_width: 1.0, chest_depth: 1.0, waist_circumference: 1.0, leg_taper: 1.0, skin_tone_hex: "#c68642" } });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`AUЯA Neural Net listening on port ${PORT}`);
});