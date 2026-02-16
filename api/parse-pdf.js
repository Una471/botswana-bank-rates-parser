// ============================================================
// BW RATE WATCH — PDF PARSER v6 (FIXED)
// Uses ONLY Gemini Vision API for accurate extraction
// ============================================================

let pdfParse;
try { pdfParse = require('pdf-parse'); } catch(e) { pdfParse = null; }

// ============================================================
// BOTSWANA BANK KNOWLEDGE BASE
// ============================================================
const BANK_KNOWLEDGE = {
  ABSA: {
    aliases: ['absa'],
    fullName: 'ABSA Bank Botswana',
    website: 'https://www.absa.co.bw',
    pdfStructure: `
ABSA BANK SPECIFIC INSTRUCTIONS:
- PLR: "Absa PLR" = 6.76% (may render as "6. %" — correct value is 6.76)
- DEPOSIT TABLE — BWP section only (ignore ZAR/GBP/USD tables):
  Current: 0.00%-1.00% nominal
  Call:    0.00%-0.55% nominal, 0.00%-0.55% effective
  Savings: 0.00%-3.60% nominal, 0.00%-3.66% effective
  FIXED DEPOSITS — 5 rows below Savings have BLANK first cells.
  The term labels float above the table visually but are NOT in the row cells.
  Map by row position:
    Row 1 = 3 Months:   1.46% nominal,       1.47% effective
    Row 2 = 6 Months:   1.73%-1.90% nominal,  1.74%-1.91% effective
    Row 3 = 12 Months:  2.57%-3.07% nominal,  2.57%-3.07% effective
    Row 4 = 24 Months:  2.92%-3.62% nominal,  2.92%-3.62% effective
    Row 5 = Over 24M:   3.02%-3.82% nominal,  3.02%-3.82% effective
- LENDING TABLE (add spread to Absa PLR 6.76 for final rate):
  MoPR = 3.50
  Mortgage:      PLR+10.50% to PLR+14%    → 17.26 to 20.76
  Overdraft:     PLR+10% to PLR+20%       → 16.76 to 26.76
  Credit Card:   24% to 36% (direct)
  Lease (VAF):   PLR+11.75% to PLR+14%   → 18.51 to 20.76
  Personal Loan: PLR+14.5% to PLR+24%    → 21.26 to 30.76
  Other LT:      Negotiable → null
- Website: https://www.absa.co.bw`
  },

  ACCESS: {
    aliases: ['access'],
    fullName: 'Access Bank Botswana',
    website: 'https://botswana.accessbankplc.com',
    pdfStructure: `
ACCESS BANK SPECIFIC INSTRUCTIONS:
- PLR: "ABB Prime" = 7.16%
- DEPOSIT: TWO side-by-side tables. Use ONLY the LEFT (BWP) table. Ignore FX table.
  Current:   Nil
  Call:      0.10%-0.60% nominal, 0.10%-0.60% effective (min P1,000)
  Savings:   0.15%-5.50% nominal, 0.15%-5.50% effective (min P100)
  91Day:     1.00%-3.50% nominal, 1.00%-3.50% effective (min P1,000)
  6 Months:  1.76%-4.01% nominal, 1.75%-4.00% effective (min P1,000)
  12 Months: 2.05%-6.25% nominal, 2.05%-6.25% effective (min P1,000)
  24 Months: 2.25%-6.25% nominal, 2.25%-6.25% effective (min P1,000)
  Over 24M:  2.55%-6.25% nominal, 2.55%-6.25% effective (min P1,000)
- LENDING TABLE (add spread to ABB Prime 7.16 for final rate):
  MoPR = 3.50
  Mortgage:      ABB Prime+0.5% to ABB Prime+10%  → 7.66 to 17.16
  Overdraft:     ABB Prime+1% to ABB Prime+20%    → 8.16 to 27.16
  Credit Card:   Up to 32% → min=0, max=32
  Lease Loans:   ABB Prime+1% to ABB Prime+10%    → 8.16 to 17.16
  Personal Loan: ABB Prime+1% to ABB Prime+25%    → 8.16 to 32.16
  Other LT: Not Available → null
- Contact phone (footer): 367 4600
- Website: https://botswana.accessbankplc.com`
  },

  BSB: {
    aliases: ['bsb', 'botswana savings'],
    fullName: 'Botswana Savings Bank (BSB)',
    website: 'https://www.bsb.bw',
    pdfStructure: `
BSB (BOTSWANA SAVINGS BANK) SPECIFIC INSTRUCTIONS:
- PLR = 8.01%
- DEPOSIT: Type | Nominal (Lowest-Highest) | Actual/Effective (Lowest-Highest) | Min Balance
  Current: NIL
  Savings sub-products:
    Sesigo:   1.75%-2.75% nominal, 1.76%-2.78% effective (min P200)
    Ordinary: 1.75% nominal,       1.76% effective         (min P50)
    SAYE:     1.25%-2.00% nominal, 1.26%-2.02% effective  (min P200)
  Savings overall: min=1.25, max=2.75
  SAYE fields:     min=1.25, max=2.00, eff_min=1.26, eff_max=2.02
  Fixed Deposits (all min P1,000):
    3 months:  0.80%-1.00% nominal,  0.80%-1.00% effective
    6 months:  1.40%-1.75% nominal,  1.41%-1.76% effective
    12 months: 1.85%-2.20% nominal,  1.87%-2.22% effective
    24 months: 2.25%-2.55% nominal,  2.27%-2.58% effective
    Over 24M:  3.35%-3.80% nominal,  3.40%-3.87% effective
- LENDING (add spread to Prime 8.01 for final rate):
  MoPR = 3.50
  Mortgage:     "Prime to Prime+5.00%" → min=8.01, max=13.01
  Overdraft:    N/A → null
  Credit Card:  N/A → null
  Eezi Auto (CAR LOAN): Prime+3.50% to Prime+8.0% → 11.51 to 16.01
  Lease Loans:  N/A → null
  Personal Loan: Prime+12% to Prime+22% → 20.01 to 30.01
  Other LT: N/A → null
- Contact phone (footer): 367 0100
- Website (footer): https://www.bsb.bw`
  },

  BBS: {
    aliases: ['bbs'],
    fullName: 'BBS Bank',
    website: 'https://www.bbs.co.bw',
    pdfStructure: `
BBS BANK SPECIFIC INSTRUCTIONS:
- IMAGE-BASED document — content drawn as graphics. Read visually.
- Look carefully across entire image for rate schedule table.
- Report period: December 2025
- Website: https://www.bbs.co.bw`
  },

  FNB: {
    aliases: ['fnb', 'first national'],
    fullName: 'FNB Botswana',
    website: 'https://www.fnbbotswana.co.bw',
    pdfStructure: `FNB BOTSWANA: First National Bank Botswana. Calculate all PLR+ rates to final values. Website: fnbbotswana.co.bw`
  },

  STANBIC: {
    aliases: ['stanbic'],
    fullName: 'Stanbic Bank Botswana',
    website: 'https://www.stanbicbank.co.bw',
    pdfStructure: `STANBIC BANK BOTSWANA: Standard Bank Group. Calculate all PLR+ rates. Website: stanbicbank.co.bw`
  },

  STANDARD_CHARTERED: {
    aliases: ['standard chartered', 'sc bank'],
    fullName: 'Standard Chartered Botswana',
    website: 'https://www.sc.com/bw',
    pdfStructure: `STANDARD CHARTERED BOTSWANA: Calculate all PLR+ rates. Website: sc.com/bw`
  },

  BANK_GABORONE: {
    aliases: ['bank gaborone', 'bankg', 'bg bank'],
    fullName: 'Bank Gaborone',
    website: 'https://www.bankg.co.bw',
    pdfStructure: `BANK GABORONE: Local Botswana bank. Calculate all PLR+ rates. Website: bankg.co.bw`
  },

  BARODA: {
    aliases: ['baroda', 'bank of baroda'],
    fullName: 'Bank of Baroda Botswana',
    website: 'https://www.bankofbaroda.co.bw',
    pdfStructure: `BANK OF BARODA BOTSWANA: Indian bank. Calculate all PLR+ rates.`
  },

  FIRST_CAPITAL: {
    aliases: ['first capital'],
    fullName: 'First Capital Bank Botswana',
    website: 'https://www.firstcapitalbank.co.bw',
    pdfStructure: `FIRST CAPITAL BANK BOTSWANA: Calculate all PLR+ rates.`
  },

  BANCABC: {
    aliases: ['bancabc', 'banc abc', 'african banking'],
    fullName: 'BancABC Botswana',
    website: 'https://www.bancabc.co.bw',
    pdfStructure: `BANCABC BOTSWANA: African Banking Corporation. Calculate all PLR+ rates. Website: bancabc.co.bw`
  }
};

const BANK_WEBSITES = {
  'ABSA Bank Botswana':           'https://www.absa.co.bw',
  'Access Bank Botswana':         'https://botswana.accessbankplc.com',
  'Botswana Savings Bank (BSB)':  'https://www.bsb.bw',
  'BBS Bank':                     'https://www.bbs.co.bw',
  'FNB Botswana':                 'https://www.fnbbotswana.co.bw',
  'Stanbic Bank Botswana':        'https://www.stanbicbank.co.bw',
  'Standard Chartered Botswana':  'https://www.sc.com/bw',
  'Bank Gaborone':                'https://www.bankg.co.bw',
  'Bank of Baroda Botswana':      'https://www.bankofbaroda.co.bw',
  'First Capital Bank Botswana':  'https://www.firstcapitalbank.co.bw',
  'BancABC Botswana':             'https://www.bancabc.co.bw',
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

function detectMimeType(filename, b64) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png')  return 'image/png';
  if (ext === 'pdf')  return 'application/pdf';
  try {
    const hx = Buffer.from(b64.substring(0, 20), 'base64').toString('hex');
    if (hx.startsWith('ffd8ff'))   return 'image/jpeg';
    if (hx.startsWith('89504e47')) return 'image/png';
  } catch {}
  return 'application/pdf';
}

function countFilled(data) {
  if (!data) return 0;
  return Object.values(data).filter(v => v !== null && v !== undefined && v !== '').length;
}

function parseJSON(raw) {
  if (!raw) return null;
  const clean = raw.trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) return null;
  return JSON.parse(match[0]);
}

function applyFallbacks(data, bankInfo) {
  if (!data) return data;
  if (!data['Bank Name'] && bankInfo) data['Bank Name'] = bankInfo.fullName;
  const site = bankInfo?.website || BANK_WEBSITES[data['Bank Name']];
  if (site && (!data['Website'] || data['Website'] === 'null')) data['Website'] = site;
  return data;
}

// ============================================================
// PROMPT BUILDER
// ============================================================
function buildPrompt(bankInfo) {
  const bankSection = bankInfo ? `\nBANK-SPECIFIC KNOWLEDGE:\n${bankInfo.pdfStructure}\n` : '';

  return `You are extracting Botswana bank interest rates from a PDF document. Look at the document CAREFULLY and extract ALL rates.

RULES:
1. All rates = plain NUMBERS only (e.g. 8.01 — not "8.01%" not "Prime+2")
2. "PLR + X%" or "Prime + X%": ADD spread to PLR for final value. E.g. PLR=8.01, +5% → 13.01
3. "Prime to Prime + 5%" means min=PLR, max=PLR+5
4. N/A, Nil, Not Available, Negotiable → null
5. Nominal and Effective are DIFFERENT — extract both
6. "91 Day" and "3 Month" are DIFFERENT products
7. "Over 24 Months" ≠ "24 Months"
8. Ignore ZAR/USD/GBP/EUR — BWP only
9. Min balance = number only (1000 not "P1,000")
10. WEBSITE: Look in header, footer, small print, watermark — anywhere in the document. Format: https://www.domain.co.bw.
11. CONTACT PHONE: Look in footer/contact section.
12. Look for "Data Month" or "Report Period" or "As at" dates in the document.
13. EXTRACT EVERY SINGLE FIELD you can find. Do not leave any field empty if the data exists in the document.

${bankSection}

Return EXACTLY this JSON structure (null for missing fields):
{
  "Bank Name": "full official name",
  "Data Month": "Month Year e.g. February 2026",
  "MoPR": 3.50,
  "Prime Lending Rate": 0.00,
  "Website": "https://www.example.co.bw",
  "Contact Phone": null,
  "Current Account Min": null, "Current Account Max": null,
  "Call Account Min": null, "Call Account Max": null,
  "Call Account Effective Min": null, "Call Account Effective Max": null,
  "Savings Min": null, "Savings Max": null,
  "Savings Effective Min": null, "Savings Effective Max": null,
  "Ordinary Savings Min": null, "Ordinary Savings Max": null,
  "SAYE Min": null, "SAYE Max": null,
  "SAYE Effective Min": null, "SAYE Effective Max": null,
  "FD 91D Nominal Min": null, "FD 91D Nominal Max": null,
  "FD 91D Effective Min": null, "FD 91D Effective Max": null,
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
  "FD Minimum Balance": 1000,
  "Mortgage Rate Min": null, "Mortgage Rate Max": null,
  "Overdraft Min": null, "Overdraft Max": null,
  "Credit Card Rate Min": null, "Credit Card Rate Max": null,
  "Car Loan Min": null, "Car Loan Max": null,
  "Lease Loan Min": null, "Lease Loan Max": null,
  "Personal Loan Min": null, "Personal Loan Max": null,
  "Other LT Min": null, "Other LT Max": null
}

IMPORTANT: Your response must be ONLY the JSON object. No markdown, no explanation, no backticks.`;
}

// ============================================================
// GEMINI API CALL
// ============================================================
async function callGemini(parts) {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error(
      'GEMINI_API_KEY is not set in Vercel environment variables. ' +
      'Go to Vercel Dashboard → Your Project → Settings → Environment Variables → ' +
      'Add GEMINI_API_KEY with your Google AI Studio key. Then redeploy.'
    );
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
          maxOutputTokens: 4096,
          topP: 0.95,
          topK: 40
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const result = await response.json();
  
  if (result.error) {
    throw new Error(`Gemini error: ${result.error.message}`);
  }

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned empty response');
  }

  return parseJSON(text);
}

// ============================================================
// MAIN HANDLER
// ============================================================
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filename, content, mimeType } = req.body || {};

    if (!filename || !content) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        details: 'filename and content are required' 
      });
    }

    const detectedMime = mimeType || detectMimeType(filename, content);
    const bankDetected = detectBank(filename);
    const bankInfo = bankDetected?.info || null;

    console.log(`\n=== Processing ${filename} | ${detectedMime} | ${bankInfo?.fullName || 'Unknown'} ===`);

    // Try Gemini Vision first (works for both PDFs and images)
    console.log('[Vision] Sending to Gemini Vision API...');
    
    const parts = [
      {
        inline_data: {
          mime_type: detectedMime,
          data: content
        }
      },
      {
        text: buildPrompt(bankInfo)
      }
    ];

    let data = await callGemini(parts);
    
    if (!data) {
      throw new Error('Failed to parse Gemini response');
    }

    // Apply fallbacks for missing data
    data = applyFallbacks(data, bankInfo);

    const filled = countFilled(data);
    const totalFields = 44; // Total number of fields we expect
    const quality = Math.round((filled / totalFields) * 100);

    console.log(`=== Success: ${data['Bank Name'] || 'Unknown'} | ${filled}/${totalFields} fields (${quality}%) ===`);

    return res.status(200).json({
      success: true,
      message: `Extracted ${filled}/${totalFields} fields (${quality}% complete)`,
      quality,
      data
    });

  } catch (error) {
    console.error('Error:', error);
    
    // Check for specific error types
    if (error.message.includes('GEMINI_API_KEY')) {
      return res.status(500).json({
        error: 'Configuration Error',
        details: error.message
      });
    }
    
    if (error.message.includes('fetch failed')) {
      return res.status(500).json({
        error: 'Network Error',
        details: 'Failed to connect to Gemini API. Check your internet connection.'
      });
    }
    
    return res.status(500).json({
      error: 'Extraction Failed',
      details: error.message
    });
  }
};
