// ============================================================
// BW RATE WATCH — PDF PARSER (OFFICIAL SDK VERSION)
// Handles PDF/Image parsing using Gemini 1.5 Flash
// ============================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');

const BANK_KNOWLEDGE = {
  ABSA: {
    aliases: ['absa'],
    fullName: 'ABSA Bank Botswana',
    website: 'https://www.absa.co.bw',
    hints: 'PLR 6.76%. FD table has BLANK row labels. Map by position: Row1=3M (1.46%), Row2=6M (1.73-1.90%), Row3=12M (2.57-3.07%), Row4=24M (2.92-3.62%), Row5=Over24M (3.02-3.82%).'
  },
  ACCESS: {
    aliases: ['access'],
    fullName: 'Access Bank Botswana',
    website: 'https://botswana.accessbankplc.com',
    hints: 'PLR 7.16% (ABB Prime). Use LEFT table (BWP) only. 91Day FD exists.'
  },
  FNB: {
    aliases: ['fnb', 'first national'],
    fullName: 'First National Bank Botswana',
    website: 'https://www.fnbbotswana.co.bw',
    hints: 'PLR 6.76%. Focus on "Interest Rates" PDF. FD categories: 7-Days, 32-Days, 6-Months, 12-Months.'
  },
  STANBIC: {
    aliases: ['stanbic'],
    fullName: 'Stanbic Bank Botswana',
    website: 'https://www.stanbicbank.co.bw',
    hints: 'PLR 6.76%. Look for "Pricing Guide" or "Rate Sheet".'
  },
  STANCHART: {
    aliases: ['scb', 'standard chartered'],
    fullName: 'Standard Chartered Bank Botswana',
    website: 'https://www.sc.com/bw',
    hints: 'PLR 6.76%. Check Savings and Term Deposit sections.'
  }
  // Add other banks back here as needed...
};

function detectBank(filename) {
  const fn = filename.toLowerCase();
  for (const [key, info] of Object.entries(BANK_KNOWLEDGE)) {
    if (info.aliases.some(alias => fn.includes(alias))) return info;
  }
  return null;
}

function detectMimeType(filename) {
  if (filename.endsWith('.pdf')) return 'application/pdf';
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/pdf';
}

function cleanJSON(text) {
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON Clean Error:", e);
    return null;
  }
}

function buildPrompt(bankInfo) {
  return `EXTRACT Botswana bank interest rates from this document.
    Return ONLY a JSON object with these EXACT keys:
    "Bank Name", "Website", "Data Month", "Prime Lending Rate",
    "Savings Min", "Savings Max", "Call Account Min", "Call Account Max",
    "FD 3M Nominal Min", "FD 3M Nominal Max", "FD 6M Nominal Min", "FD 6M Nominal Max",
    "FD 12M Nominal Min", "FD 12M Nominal Max", "FD 24M Nominal Min", "FD 24M Nominal Max",
    "Mortgage Variable Min", "Mortgage Variable Max", "Personal Loan Min", "Personal Loan Max".
    
    RULES:
    1. Values must be NUMBERS or NULL (no % signs).
    2. Bank: ${bankInfo ? bankInfo.fullName : 'Detect from document'}.
    3. Hints: ${bankInfo ? bankInfo.hints : 'Extract all available rates'}.
    4. If a range is given (e.g. 2.5% - 3.5%), fill both Min and Max.`;
}

// Initialize the Gemini SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function callGeminiVision(base64Content, mimeType, prompt) {
  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Content,
          mimeType: mimeType
        }
      }
    ]);
    const response = await result.response;
    return cleanJSON(response.text());
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { filename, content } = req.body;
    if (!content) return res.status(400).json({ error: 'No file content provided' });

    const mimeType = detectMimeType(filename || 'document.pdf');
    const bankInfo = detectBank(filename || '');
    const prompt = buildPrompt(bankInfo);

    console.log(`Processing: ${filename} (${mimeType})`);

    const data = await callGeminiVision(content, mimeType, prompt);

    if (!data) {
      throw new Error('Failed to parse Gemini response');
    }

    // Fallbacks
    if (!data['Bank Name'] && bankInfo) data['Bank Name'] = bankInfo.fullName;
    if (bankInfo?.website && !data['Website']) data['Website'] = bankInfo.website;

    return res.status(200).json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('Extraction Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
