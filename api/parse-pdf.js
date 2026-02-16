// ============================================================
// BW RATE WATCH — PDF PARSER v7 (CORS FIXED)
// ============================================================

// ============================================================
// BOTSWANA BANK KNOWLEDGE BASE
// ============================================================
const BANK_KNOWLEDGE = {
  ABSA: {
    aliases: ['absa'],
    fullName: 'ABSA Bank Botswana',
    website: 'https://www.absa.co.bw',
    pdfStructure: `
ABSA BANK:
- PLR: 6.76%
- Current: 0.00%-1.00%
- Call: 0.00%-0.55% nominal, 0.00%-0.55% effective
- Savings: 0.00%-3.60% nominal, 0.00%-3.66% effective
- 3 Months: 1.46% nominal, 1.47% effective
- 6 Months: 1.73%-1.90% nominal, 1.74%-1.91% effective
- 12 Months: 2.57%-3.07% nominal, 2.57%-3.07% effective
- 24 Months: 2.92%-3.62% nominal, 2.92%-3.62% effective
- Over 24M: 3.02%-3.82% nominal, 3.02%-3.82% effective
- Mortgage: 17.26% to 20.76%
- Overdraft: 16.76% to 26.76%
- Credit Card: 24% to 36%
- Personal Loan: 21.26% to 30.76%`
  },

  ACCESS: {
    aliases: ['access'],
    fullName: 'Access Bank Botswana',
    website: 'https://botswana.accessbankplc.com',
    pdfStructure: `
ACCESS BANK:
- PLR: 7.16%
- Current: Nil
- Call: 0.10%-0.60% nominal, 0.10%-0.60% effective
- Savings: 0.15%-5.50% nominal, 0.15%-5.50% effective
- 91Day: 1.00%-3.50% nominal, 1.00%-3.50% effective
- 6 Months: 1.76%-4.01% nominal, 1.75%-4.00% effective
- 12 Months: 2.05%-6.25% nominal, 2.05%-6.25% effective
- 24 Months: 2.25%-6.25% nominal, 2.25%-6.25% effective
- Over 24M: 2.55%-6.25% nominal, 2.55%-6.25% effective
- Mortgage: 7.66% to 17.16%
- Overdraft: 8.16% to 27.16%
- Credit Card: Up to 32%
- Personal Loan: 8.16% to 32.16%`
  },

  BSB: {
    aliases: ['bsb', 'botswana savings'],
    fullName: 'Botswana Savings Bank (BSB)',
    website: 'https://www.bsb.bw',
    pdfStructure: `
BSB:
- PLR: 8.01%
- Current: NIL
- Savings: 1.25%-2.75% nominal, 1.26%-2.78% effective
- SAYE: 1.25%-2.00% nominal, 1.26%-2.02% effective
- 3 months: 0.80%-1.00% nominal, 0.80%-1.00% effective
- 6 months: 1.40%-1.75% nominal, 1.41%-1.76% effective
- 12 months: 1.85%-2.20% nominal, 1.87%-2.22% effective
- 24 months: 2.25%-2.55% nominal, 2.27%-2.58% effective
- Over 24M: 3.35%-3.80% nominal, 3.40%-3.87% effective
- Mortgage: 8.01% to 13.01%
- Car Loan: 11.51% to 16.01%
- Personal Loan: 20.01% to 30.01%`
  },

  FNB: {
    aliases: ['fnb', 'first national'],
    fullName: 'FNB Botswana',
    website: 'https://www.fnbbotswana.co.bw',
    pdfStructure: `FNB BOTSWANA`
  },

  STANBIC: {
    aliases: ['stanbic'],
    fullName: 'Stanbic Bank Botswana',
    website: 'https://www.stanbicbank.co.bw',
    pdfStructure: `STANBIC BANK`
  },

  STANDARD_CHARTERED: {
    aliases: ['standard chartered', 'sc bank'],
    fullName: 'Standard Chartered Botswana',
    website: 'https://www.sc.com/bw',
    pdfStructure: `STANDARD CHARTERED`
  },

  BANK_GABORONE: {
    aliases: ['bank gaborone', 'bankg'],
    fullName: 'Bank Gaborone',
    website: 'https://www.bankg.co.bw',
    pdfStructure: `BANK GABORONE`
  }
};

// ============================================================
// HELPERS
// ============================================================
function detectBank(filename) {
  const lower = (filename || '').toLowerCase();
  for (const [key, info] of Object.entries(BANK_KNOWLEDGE)) {
    if (info.aliases.some(a => lower.includes(a))) return { key, info };
  }
  return null;
}

function detectMimeType(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  return 'application/pdf';
}

function countFilled(data) {
  if (!data) return 0;
  return Object.values(data).filter(v => v !== null && v !== undefined && v !== '').length;
}

function parseJSON(raw) {
  if (!raw) return null;
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return null;
  }
}

function applyFallbacks(data, bankInfo) {
  if (!data) return data;
  if (!data['Bank Name'] && bankInfo) data['Bank Name'] = bankInfo.fullName;
  if (bankInfo?.website && (!data['Website'] || data['Website'] === 'null')) {
    data['Website'] = bankInfo.website;
  }
  return data;
}

// ============================================================
// PROMPT BUILDER
// ============================================================
function buildPrompt(bankInfo) {
  const bankSection = bankInfo ? `\nBANK INFO:\n${bankInfo.pdfStructure}\n` : '';

  return `Extract bank interest rates from this document. Return ONLY JSON.

${bankSection}

Return this EXACT structure:
{
  "Bank Name": "",
  "Data Month": "",
  "MoPR": 3.50,
  "Prime Lending Rate": null,
  "Website": "",
  "Contact Phone": null,
  "Current Account Min": null, "Current Account Max": null,
  "Call Account Min": null, "Call Account Max": null,
  "Call Account Effective Min": null, "Call Account Effective Max": null,
  "Savings Min": null, "Savings Max": null,
  "Savings Effective Min": null, "Savings Effective Max": null,
  "FD 3M Nominal Min": null, "FD 3M Nominal Max": null,
  "FD 3M Effective Min": null, "FD 3M Effective Max": null,
  "FD 6M Nominal Min": null, "FD 6M Nominal Max": null,
  "FD 6M Effective Min": null, "FD 6M Effective Max": null,
  "FD 12M Nominal Min": null, "FD 12M Nominal Max": null,
  "FD 12M Effective Min": null, "FD 12M Effective Max": null,
  "FD 24M Nominal Min": null, "FD 24M Nominal Max": null,
  "FD 24M Effective Min": null, "FD 24M Effective Max": null,
  "FD Over24M Nominal Min": null, "FD Over24M Nominal Max": null,
  "FD Over24M Effective Min": null, "FD Over24M Effective Max": null,
  "Mortgage Rate Min": null, "Mortgage Rate Max": null,
  "Personal Loan Min": null, "Personal Loan Max": null,
  "Car Loan Min": null, "Car Loan Max": null,
  "Credit Card Rate Min": null, "Credit Card Rate Max": null
}`;
}

// ============================================================
// GEMINI API CALL
// ============================================================
async function callGemini(parts) {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error('GEMINI_API_KEY not found');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { 
          temperature: 0.1,
          maxOutputTokens: 4096
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini error: ${error}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) {
    throw new Error('Gemini returned empty');
  }

  return parseJSON(text);
}

// ============================================================
// MAIN HANDLER
// ============================================================
module.exports = async (req, res) => {
  // Set CORS headers for ALL requests (including OPTIONS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filename, content } = req.body || {};

    if (!filename || !content) {
      return res.status(400).json({ error: 'Missing filename or content' });
    }

    const mimeType = detectMimeType(filename);
    const bankDetected = detectBank(filename);
    const bankInfo = bankDetected?.info || null;

    // Call Gemini
    const data = await callGemini([
      {
        inline_data: {
          mime_type: mimeType,
          data: content
        }
      },
      {
        text: buildPrompt(bankInfo)
      }
    ]);

    if (!data) {
      throw new Error('Failed to parse response');
    }

    const finalData = applyFallbacks(data, bankInfo);
    const filled = countFilled(finalData);
    const quality = Math.round((filled / 44) * 100);

    return res.status(200).json({
      success: true,
      message: `Extracted ${filled}/44 fields (${quality}%)`,
      quality,
      data: finalData
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: 'Extraction failed', 
      details: error.message 
    });
  }
};
