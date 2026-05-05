const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: 'backend/.env' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
async function run() {
  for (const model of ["gemini-2.0-flash", "gemini-flash-latest", "gemini-3-flash-preview"]) {
    try {
      await genAI.getGenerativeModel({ model }).generateContent("hello");
      console.log(model + " WORKS");
      return;
    } catch (e) {
      console.log(model + " FAILED: " + e.statusText);
    }
  }
}
run();
