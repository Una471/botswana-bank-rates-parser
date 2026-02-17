// ============================================================
// BW RATE WATCH — PDF PARSER (STABLE SDK VERSION)
// Fixes 404 error by switching to v1 API and -latest alias
// ============================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');

const BANK_KNOWLEDGE = {
  ABSA: { fullName: 'ABSA Bank Botswana', website: 'https://www.absa.co.bw', hints: 'PLR 6.76%. Map FD by position: 3M, 6M, 12M, 24M.' },
  ACCESS: { fullName: 'Access Bank Botswana', website: 'https://botswana.accessbankplc.com', hints: 'PLR 7.16%. Use BWP table only.' },
  FNB: { fullName: 'First National Bank Botswana', website: 'https://www.fnbbotswana.co.bw', hints: 'PLR 6.76%. Focus on Interest Rates PDF.' },
  STANBIC: { fullName: 'Stanbic Bank Botswana', website: 'https://www.stanbicbank.co.bw', hints: 'PLR 6.76%.' },
  STANCHART: { fullName: 'Standard Chartered Bank Botswana', website: 'https://www.sc.com/bw', hints: 'PLR 6.76%.' }
};

function detectBank(filename) {
  const fn = (filename || '').toLowerCase();
  for (const [key, info] of Object.entries(BANK_KNOWLEDGE)) {
    if (fn.includes(key.toLowerCase())) return info;
  }
  return null;
}

function cleanJSON(text) {
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    return null;
  }
}

// Initialize the Gemini SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// FORCE v1 API to avoid v1beta 404 errors
const model = genAI.getGenerativeModel(
  { model: "gemini-1.5-flash-latest" }, // Use -latest alias
  { apiVersion: "v1" }                   // Force stable v1
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "Missing API Key" });

  try {
    const { filename, content } = req.body;
    if (!content) return res.status(400).json({ error: 'No content' });

    const bankInfo = detectBank(filename);
    const prompt = `EXTRACT Botswana bank rates. Return ONLY JSON with keys: "Bank Name", "Website", "Data Month", "Prime Lending Rate", "Savings Max", "FD 12M Nominal Max", "Mortgage Variable Min", "Personal Loan Min". Bank: ${bankInfo?.fullName || 'Auto'}.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: content, mimeType: filename?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg' } }
    ]);

    const response = await result.response;
    const data = cleanJSON(response.text());

    if (!data) throw new Error("Invalid AI response format");

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Gemini Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};
