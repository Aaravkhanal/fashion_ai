require('dotenv').config({ path: './backend/.env' });
console.log("Using Key:", process.env.GEMINI_API_KEY ? "YES" : "NO");
console.log("HF Token:", process.env.HF_TOKEN ? "YES" : "NO");
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { tryOnOutfit } = require('./services/vtonService');

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
        const { message, image, history } = req.body;
        console.log("1. Frontend sent text:", message);
        if (image) console.log("   [+] Received image attachment");

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: "You are AUЯA, a witty, slightly sarcastic, and genuinely enthusiastic high-end fashion editor. You act as an honest, direct personal stylist. You are NOT an AI assistant, you are a fashion authority. Rules:\n1. You MUST process and directly reference the user's specific input and past messages.\n2. Be conversational, enthusiastic about good style, but brutally honest about bad choices. Use a bit of sass.\n3. Output exactly 1-2 specific clothing item suggestions so the user can 'TRY THIS IN MIRROR'.\n4. Add subtle high-fashion easter eggs (e.g., 'very McQueen 1999', 'giving Prada runway').\n5. Keep it concise. Never use boring AI greetings."
        });

        let context = "";
        if (history && history.length > 0) {
            context = "Past conversation context:\n" + history.slice(-4).map(h => `${h.role}: ${h.text}`).join('\n') + "\n\n";
        }
        
        const parts = [{ text: context + "User's current message: " + (message || "What do you think of this?") }];

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

        try {
            const imageModel = genAI.getGenerativeModel({
                model: "gemini-2.0-flash-exp",
                generationConfig: { responseModalities: ["IMAGE", "TEXT"] }
            });

            const parts = [{ text: tryOnPrompt }];
            if (image) {
                const mimeTypeMatch = image.match(/data:(.*?);base64/);
                const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";
                const base64Data = image.split(',')[1] || image;
                parts.push({ inlineData: { data: base64Data, mimeType } });
            }

            const result = await imageModel.generateContent(parts);
            const responseParts = result.response.candidates[0].content.parts;

            for (const part of responseParts) {
                if (part.inlineData) {
                    const generatedBase64 = part.inlineData.data;
                    const generatedMime = part.inlineData.mimeType || "image/png";
                    const imageUrl = `data:${generatedMime};base64,${generatedBase64}`;
                    console.log("   [+] Generated via Gemini 2.0 Flash");
                    return res.json({ imageUrl });
                }
            }
            throw new Error("No image in Gemini response");

        } catch (geminiError) {
            console.log("   [!] Gemini image gen failed:", geminiError.message);
            console.log("   [→] Falling back to Pollinations AI engine...");
            const fallbackPrompt = `Photorealistic fashion photography, person wearing: ${prompt}, studio lighting, high-end fashion catalog, detailed clothing textures, full body shot`;
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fallbackPrompt)}?width=1024&height=1024&nologo=true`;
            return res.json({ imageUrl });
        }

    } catch (error) {
        console.error("Image Gen Error:", error);
        res.status(500).json({ error: "Grid interference detected." });
    }
});

// ── VIRTUAL TRY-ON (IDM-VTON) ROUTE ─────────────────────────────────
app.post('/api/try-on', async (req, res) => {
    try {
        const { userImage, garmentImage } = req.body;
        
        if (!userImage || !garmentImage) {
            return res.status(400).json({ error: "Missing userImage or garmentImage" });
        }

        console.log("1. Starting AI Dressing process...");
        const resultUrl = await tryOnOutfit(userImage, garmentImage);
        
        console.log("2. Dressing complete:", resultUrl);
        res.json({ imageUrl: resultUrl });

    } catch (error) {
        console.error("VTON Route Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ── PINTEREST SCRAPER ROUTE ──────────────────────────────────────────
app.get('/api/pinterest', async (req, res) => {
    try {
        const query = req.query.q || 'luxury minimalist fashion';
        console.log("Pinterest search:", query);

        const apiRes = await fetch(
            `https://pinterest130.p.rapidapi.com/pins/search?query=${encodeURIComponent(query)}&limit=20`,
            {
                headers: {
                    'x-rapidapi-key': process.env.RAPIDAPI_KEY,
                    'x-rapidapi-host': 'pinterest130.p.rapidapi.com'
                }
            }
        );

        const data = await apiRes.json();

        // Flexible image extraction — handle multiple response shapes
        let images = [];
        if (Array.isArray(data)) {
            images = data.map(pin =>
                pin.images?.orig?.url || pin.image_url || pin.grid_title_image_url
            ).filter(Boolean);
        } else if (data.results && Array.isArray(data.results)) {
            images = data.results.map(pin =>
                pin.images?.orig?.url || pin.image_url
            ).filter(Boolean);
        } else if (data.data && Array.isArray(data.data)) {
            images = data.data.map(pin =>
                pin.images?.orig?.url || pin.image_url
            ).filter(Boolean);
        }

        if (images.length > 0) {
            console.log(`   Found ${images.length} Pinterest images`);
            return res.json({ images });
        }

        throw new Error("No images extracted");

    } catch (error) {
        console.error("Pinterest API Error:", error.message);
        // Fallback: curated Unsplash fashion images
        const fallback = [
            'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1492288991661-058aa541ff43?w=400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1550614000-4b95d4662d57?w=400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1544957992-20514f595d6f?w=400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1581044777550-4cfa60707998?w=400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop'
        ];
        res.json({ images: fallback });
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