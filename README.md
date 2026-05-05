# AUЯA | Bespoke Digital Atelier

AUЯA is a high-fidelity, AI-powered fashion ecosystem that bridges the gap between digital inspiration and personal reality. By merging **Pinterest-driven trends** with cutting-edge **Virtual Try-On (VTON)** technology, AUЯA provides a personalized, "Quiet Luxury" shopping experience for Men, Women, and Kids.

![Version](https://img.shields.io/badge/Version-2.0.0-D4AF37?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-Next.js%20%7C%20Node.js%20%7C%20AI-white?style=flat-square)

---

## 🌟 The Experience

AUЯA isn't just an e-commerce tool; it’s a digital mirror. Our pipeline is designed to provide a seamless transition from "I like this" to "How do I look in this?"

* **Identity Scanning:** Biometric-based 2D digital twinning using height, weight, and face-scan data.
* **The Global Closet:** Real-time fashion scraping via the Pinterest Data API.
* **Virtual Try-On (VTON):** Authentic garment physics and rendering powered by the **IDM-VTON** neural engine.
* **Witty Stylist AI:** A conversational fashion assistant with a high-fashion personality, capable of sending outfits directly to your mirror.
* **The Digital Runway:** A high-performance 3D environment for previewing styled ensembles.

---

## 🏗️ Technical Architecture

### Tech Stack
- **Frontend:** Next.js (React) with Framer Motion for cinematic animations.
- **Backend:** Node.js & Express (Secure API Layer).
- **AI Engine:** Hugging Face IDM-VTON (Diffusion-based Virtual Try-on).
- **Data Source:** Pinterest API (Fashion discovery).
- **Styling:** Custom CSS with a #1A1A1A (Charcoal) and #D4AF37 (Soft Gold) luxury palette.

### The Pipeline
1.  **Ingestion:** User uploads a photo and defines biometrics.
2.  **Discovery:** Pinterest API populates an "Editorial Grid" of trending clothes.
3.  **Processing:** A secure backend request is sent to the Hugging Face inference endpoint.
4.  **Generation:** The AI maps the selected garment onto the user's specific body type, preserving texture and drape.

---

## 🚀 Installation & Setup

1. **Clone the Repository:**
   ```bash
   git clone [https://github.com/Aaravkhanal/fashion_ai.git](https://github.com/Aaravkhanal/fashion_ai.git)
   cd fashion_ai
