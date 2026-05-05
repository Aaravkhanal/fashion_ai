const { Client } = require("@gradio/client");

/**
 * Service to handle Virtual Try-On via Hugging Face
 */
const tryOnOutfit = async (userImageURL, garmentImageURL) => {
    try {
        // Connect to the IDM-VTON space
        const client = await Client.connect("yisol/IDM-VTON", {
            hf_token: process.env.HF_TOKEN
        });

        // The IDM-VTON model requires specific parameters
        const result = await client.predict("/tryon", {
            dict: {
                "background": userImageURL,
                "layers": [],
                "composite": null
            },
            garm_img: garmentImageURL,
            garment_des: "A high-end garment for the AUЯA digital mirror",
            is_checked: true,
            is_checked_crop: false,
            denoise_steps: 30,
            seed: 42,
        });

        // Returns the URL of the generated image
        return result.data[0].url;
    } catch (error) {
        console.error("VTON Service Error:", error);
        throw new Error("AI Dressing failed. Please try again.");
    }
};

module.exports = { tryOnOutfit };