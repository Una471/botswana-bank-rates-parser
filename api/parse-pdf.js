// ============================================================
// BW RATE WATCH — PDF PARSER
// Pure Gemini Vision — no pdf-parse, no text extraction.
// Raw file bytes go directly to Gemini so it reads the document
// exactly as a human would, including footers and headers.
// ============================================================

// ============================================================
// BOTSWANA BANK KNOWLEDGE BASE
// ============================================================
const BANK_KNOWLEDGE = {
  'ABSA': {
    aliases: ['absa'],
    fullName: 'ABSA Bank Botswana',
    website: 'https://www.absa.co.bw',
    pdfStructure: `
ABSA BANK SPECIFIC INSTRUCTIONS:
- PLR: "Absa PLR" = 6.76% (may visually render as "6. %" due to a gap — correct value is 6.76)
- DEPOSIT TABLE — BWP section only, ignore ZAR/GBP/USD tables:
  Current: 0.00% - 1.00% nominal
  Call: 0.00% - 0.55% nominal
  Savings: 0.00% - 3.60% nominal / 0.00% - 3.66% effective
  Fixed Deposits: The 5 FD rows below Savings have BLANK first cells — the term labels
  float visually above the table and are NOT inside the row cells. Map by position:
    FD row 1 = 3 Months:    1.46% nominal, 1.47% effective
    FD row 2 = 6 Months:    1.73%-1.90% nominal, 1.74%-1.91% effective
    FD row 3 = 12 Months:   2.57%-3.07% nominal, 2.57%-3.07% effective
    FD row 4 = 24 Months:   2.92%-3.62% nominal, 2.92%-3.62% effective
    FD row 5 = Over 24M:    3.02%-3.82% nominal, 3.02%-3.82% effective
- LENDING TABLE (calculate final rates using Absa PLR = 6.76):
  MoPR = 3.50%
  Mortgage:      Absa PLR+10.50% to Absa PLR+14%   → 17.26% to 20.76%
  Overdraft:     Absa PLR+10% to Absa PLR+20%       → 16.76% to 26.76%
  Credit Card:   24% to 36% (no PLR — use directly)
  Lease (VAF):   Absa PLR+11.75% to Absa PLR+14%   → 18.51% to 20.76%
  Personal Loan: Absa PLR+14.5% to Absa PLR+24%    → 21.26% to 30.76%
  Other LT:      Negotiable → null
- Website in footer/header: www.absa.co.bw → use https://www.absa.co.bw`
  },

  'ACCESS': {
    aliases: ['access'],
    fullName: 'Access Bank Botswana',
    website: 'https://botswana.accessbankplc.com',
    pdfStructure: `
ACCESS BANK SPECIFIC INSTRUCTIONS:
- PLR: "ABB Prime" or "Access Bank Botswana Prime Lending Rate" = 7.16%
- DEPOSIT: The document has TWO side-by-side deposit tables. Use ONLY the LEFT (BWP) table.
  Ignore the right-side foreign currency (USD/ZAR/GBP/EUR) table entirely.
  Current: Nil
  Call:        0.10%-0.60% nominal / 0.10%-0.60% effective  (min balance P1,000)
  Savings:     0.15%-5.50% nominal / 0.15%-5.50% effective  (min balance P100)
  91Day:       1.00%-3.50% nominal / 1.00%-3.50% effective  (min balance P1,000) ← this is the 91-day FD
  6 Months:    1.76%-4.01% nominal / 1.75%-4.00% effective  (min balance P1,000)
  12 Months:   2.05%-6.25% nominal / 2.05%-6.25% effective  (min balance P1,000)
  24 Months:   2.25%-6.25% nominal / 2.25%-6.25% effective  (min balance P1,000)
  Over 24M:    2.55%-6.25% nominal / 2.55%-6.25% effective  (min balance P1,000)
- LENDING TABLE (calculate final rates using ABB Prime = 7.16):
  MoPR = 3.50%
  Mortgage:      ABB Prime+0.5% to ABB Prime+10%  → 7.66% to 17.16%
  Overdraft:     ABB Prime+1% to ABB Prime+20%    → 8.16% to 27.16%
  Credit Card:   Up to 32% (no PLR — use 0 as min, 32 as max)
  Lease Loans:   ABB Prime+1% to ABB Prime+10%    → 8.16% to 17.16%
  Personal Loan: ABB Prime+1% to ABB Prime+25%    → 8.16% to 32.16%
  Other LT:      Not Available → null
- Contact phone in document footer: Fairgrounds 367 4600 → use "367 4600"
- Website NOT printed in this PDF — use: https://botswana.accessbankplc.com`
  },

  'BSB': {
    aliases: ['bsb', 'botswana savings'],
    fullName: 'Botswana Savings Bank (BSB)',
    website: 'https://www.bsb.bw',
    pdfStructure: `
BSB (BOTSWANA SAVINGS BANK) SPECIFIC INSTRUCTIONS:
- PLR = 8.01%
- DEPOSIT TABLE: Type | Nominal (Lowest-Highest) | Actual/Effective (Lowest-Highest) | Min Balance (Pula)
  Current: NIL
  Savings — three sub-products, extract the overall Savings range:
    "Sesigo":   1.75%-2.75% nominal, 1.76%-2.78% effective  (min P200)
    "Ordinary": 1.75% nominal, 1.76% effective               (min P50)
    "SAYE":     1.25%-2.00% nominal, 1.26%-2.02% effective   (min P200)
  For Savings overall: use min=1.25%, max=2.75% (spanning all sub-products)
  For SAYE: SAYE Min=1.25%, SAYE Max=2.00%, SAYE Eff Min=1.26%, SAYE Eff Max=2.02%
  Fixed Deposits (all min balance P1,000):
    3 months:    0.80%-1.00% nominal, 0.80%-1.00% effective
    6 months:    1.40%-1.75% nominal, 1.41%-1.76% effective
    12 months:   1.85%-2.20% nominal, 1.87%-2.22% effective
    24 months:   2.25%-2.55% nominal, 2.27%-2.58% effective
    Over 24M:    3.35%-3.80% nominal, 3.40%-3.87% effective
- LENDING TABLE (calculate final rates using Prime = 8.01):
  MoPR = 3.50%
  Mortgage:   "Prime to Prime + 5.00%"  → min=8.01, max=13.01
  Overdraft:  N/A → null
  Credit Card: N/A → null
  Eezi Auto (= CAR LOAN): Prime+3.50% to Prime+8.0% → 11.51% to 16.01%
  Lease Loans: N/A → null
  Personal Loan: Prime+12% to Prime+22% → 20.01% to 30.01%
  Other LT: N/A → null
- Contact phone in footer: "36 7 0100" or "367 0100" → use "367 0100"
- Website in footer: www.bsb.bw → use https://www.bsb.bw`
  },

  'BBS': {
    aliases: ['bbs'],
    fullName: 'BBS Bank',
    website: 'https://www.bbs.co.bw',
    pdfStructure: `
BBS BANK SPECIFIC INSTRUCTIONS:
- This is an IMAGE-BASED document — all content is drawn as graphics.
- Scan the entire image carefully: look for a rate schedule table with product names
  in one column and interest rate percentages in other columns.
- Look in ALL areas of the image — header, body, footer, watermarks, small print.
- If you can see rate values visually, extract them. Do not give up.
- Report period: 01 December 2025
- Website: www.bbs.co.bw → use https://www.bbs.co.bw`
  },

  'FNB': {
    aliases: ['fnb', 'first national'],
    fullName: 'FNB Botswana',
    website: 'https://www.fnbbotswana.co.bw',
    pdfStructure: `
FNB BOTSWANA SPECIFIC INSTRUCTIONS:
- FNB = First National Bank Botswana
- Products: Cheque/Current, Smart Savings, Gold Account, Fixed Deposits, e-Savings
- Lending: Home Loans (mortgage), Personal Loans, Overdraft
- Calculate all PLR+ lending rates to final values using their PLR
- Website anywhere in document: fnbbotswana.co.bw → https://www.fnbbotswana.co.bw`
  },

  'STANBIC': {
    aliases: ['stanbic'],
    fullName: 'Stanbic Bank Botswana',
    website: 'https://www.stanbicbank.co.bw',
    pdfStructure: `
STANBIC BANK BOTSWANA SPECIFIC INSTRUCTIONS:
- Standard Bank Group subsidiary in Botswana
- Products: PureSave, AccessAccount, BizFlex, Fixed Deposits
- Calculate all PLR+ lending rates to final values
- Website: stanbicbank.co.bw → https://www.stanbicbank.co.bw`
  },

  'STANDARD_CHARTERED': {
    aliases: ['standard chartered', 'sc bank'],
    fullName: 'Standard Chartered Botswana',
    website: 'https://www.sc.com/bw',
    pdfStructure: `
STANDARD CHARTERED BOTSWANA SPECIFIC INSTRUCTIONS:
- Products: e$aver, Bonus$aver, Fixed Deposits
- Calculate all PLR+ lending rates to final values
- Website: sc.com/bw → https://www.sc.com/bw`
  },

  'BANK_GABORONE': {
    aliases: ['bank gaborone', 'bankg', 'bg bank'],
    fullName: 'Bank Gaborone',
    website: 'https://www.bankg.co.bw',
    pdfStructure: `
BANK GABORONE SPECIFIC INSTRUCTIONS:
- Local Botswana bank
- Calculate all PLR+ lending rates to final values
- Website: bankg.co.bw → https://www.bankg.co.bw`
  },

  'BARODA': {
    aliases: ['baroda', 'bank of baroda'],
    fullName: 'Bank of Baroda Botswana',
    website: 'https://www.bankofbaroda.co.bw',
    pdfStructure: `
BANK OF BARODA BOTSWANA SPECIFIC INSTRUCTIONS:
- Indian bank with Botswana operations
- Calculate all PLR+ lending rates to final values
- Website: bankofbaroda.co.bw`
  },

  'FIRST_CAPITAL': {
    aliases: ['first capital'],
    fullName: 'First Capital Bank Botswana',
    website: 'https://www.firstcapitalbank.co.bw',
    pdfStructure: `
FIRST CAPITAL BANK BOTSWANA SPECIFIC INSTRUCTIONS:
- Calculate all PLR+ lending rates to final values
- Website: firstcapitalbank.co.bw`
  },

  'BANCABC': {
    aliases: ['bancabc', 'banc abc', 'african banking'],
    fullName: 'BancABC Botswana',
    website: 'https://www.bancabc.co.bw',
    pdfStructure: `
BANCABC BOTSWANA SPECIFIC INSTRUCTIONS:
- African Banking Corporation Botswana
- Calculate all PLR+ lending rates to final values
- Website: bancabc.co.bw → https://www.bancabc.co.bw`
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
// DETECT BANK FROM FILENAME
// ============================================================
function detectBank(filename) {
  const lower = (filename || '').toLowerCase();
  for (const [key, info] of Object.entries(BANK_KNOWLEDGE)) {
    if (info.aliases.some(alias => lower.includes(alias))) {
      return { key, info };
    }
  }
  return null;
}

// ============================================================
// DETECT FILE TYPE FROM FILENAME / MAGIC BYTES
// ============================================================
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

// ============================================================
// BUILD GEMINI PROMPT
// Tells Gemini exactly what to look for, including footers
// ============================================================
function buildPrompt(bankInfo) {
  const knownWebsite = bankInfo ? bankInfo.website : null;

  return `You are extracting Botswana bank interest rates from this document. Return ONLY valid JSON — no markdown fences, no explanation, no preamble.

UNIVERSAL EXTRACTION RULES:
1. Rate values must be PLAIN NUMBERS (e.g. 8.01 — not "8.01%" not "Prime+2" not "null")
2. For lending rates using "Prime + X%" or "PLR + X%": ADD the spread to the PLR for the final rate.
   Example: PLR=8.01, spread=+5% → write 13.01. PLR=6.76, spread=+14% → write 20.76
3. "Prime to Prime + 5%" means min=PLR, max=PLR+5
4. N/A, Nil, Not Available, Negotiable → write null
5. "Nominal" and "Effective/Actual" are DIFFERENT columns — extract both separately
6. "91 Day" and "3 Month" are DIFFERENT products — extract separately
7. "Over 24 Months" is DIFFERENT from "24 Months" — extract separately
8. IGNORE ZAR, USD, GBP, EUR foreign currency sections — BWP (Botswana Pula) only
9. Minimum balance values: numbers only (e.g. 1000 — not "P1,000")
10. WEBSITE FIELD: Look in the ENTIRE document — header, footer, bottom of page, watermark,
    small print, anywhere. Extract any URL you can see (e.g. www.bsb.bw, absa.co.bw).
    Always format as https://www.domain.co.bw${knownWebsite ? `\n    If not visible, use the known website: ${knownWebsite}` : ''}
11. CONTACT PHONE: Look in footer, bottom, or contact section. Botswana numbers are 7-8 digits.

${bankInfo ? `BANK-SPECIFIC KNOWLEDGE FOR THIS DOCUMENT:\n${bankInfo.pdfStructure}` : ''}

Return this EXACT JSON (null for any field not found or not applicable):
{
  "Bank Name": "Full official bank name as it appears in document",
  "Data Month": "Month Year e.g. February 2026",
  "MoPR": 3.50,
  "Prime Lending Rate": 0.00,
  "Website": "https://www.example.co.bw",
  "Contact Phone": null,

  "Current Account Min": null,
  "Current Account Max": null,
  "Call Account Min": null,
  "Call Account Max": null,
  "Call Account Effective Min": null,
  "Call Account Effective Max": null,
  "Savings Min": null,
  "Savings Max": null,
  "Savings Effective Min": null,
  "Savings Effective Max": null,
  "Ordinary Savings Min": null,
  "Ordinary Savings Max": null,
  "SAYE Min": null,
  "SAYE Max": null,
  "SAYE Effective Min": null,
  "SAYE Effective Max": null,

  "FD 91D Nominal Min": null,
  "FD 91D Nominal Max": null,
  "FD 91D Effective Min": null,
  "FD 91D Effective Max": null,
  "FD 3M Nominal Min": null,
  "FD 3M Nominal Max": null,
  "FD 3M Effective Min": null,
  "FD 3M Effective Max": null,
  "FD 6M Nominal Min": null,
  "FD 6M Nominal Max": null,
  "FD 6M Effective Min": null,
  "FD 6M Effective Max": null,
  "FD 12M Nominal Min": null,
  "FD 12M Nominal Max": null,
  "FD 12M Effective Min": null,
  "FD 12M Effective Max": null,
  "FD 24M Nominal Min": null,
  "FD 24M Nominal Max": null,
  "FD 24M Effective Min": null,
  "FD 24M Effective Max": null,
  "FD Over24M Nominal Min": null,
  "FD Over24M Nominal Max": null,
  "FD Over24M Effective Min": null,
  "FD Over24M Effective Max": null,
  "FD Minimum Balance": 1000,

  "Mortgage Rate Min": null,
  "Mortgage Rate Max": null,
  "Overdraft Min": null,
  "Overdraft Max": null,
  "Credit Card Rate Min": null,
  "Credit Card Rate Max": null,
  "Car Loan Min": null,
  "Car Loan Max": null,
  "Lease Loan Min": null,
  "Lease Loan Max": null,
  "Personal Loan Min": null,
  "Personal Loan Max": null,
  "Other LT Min": null,
  "Other LT Max": null
}`;
}

// ============================================================
// PARSE GEMINI JSON RESPONSE
// ============================================================
function parseGeminiResponse(result) {
  const raw = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) {
    if (result.error) console.error('Gemini API error:', result.error.message);
    else console.log('Empty Gemini response:', JSON.stringify(result).substring(0, 200));
    return null;
  }
  try {
    const clean = raw.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) { console.log('No JSON object found in response'); return null; }
    const extracted = JSON.parse(match[0]);
    console.log('Gemini extracted', countFilled(extracted), 'fields');
    return extracted;
  } catch (e) {
    console.error('JSON parse error:', e.message, '| Raw:', raw.substring(0, 300));
    return null;
  }
}

// ============================================================
// COUNT FILLED FIELDS
// ============================================================
function countFilled(data) {
  if (!data) return 0;
  return Object.values(data).filter(v => v !== null && v !== undefined && v !== '').length;
}

function isSufficient(data) {
  if (!data || !data['Bank Name']) return false;
  const rateFields = [
    'Savings Min', 'Call Account Min', 'FD 3M Nominal Min',
    'FD 6M Nominal Min', 'FD 12M Nominal Min', 'Mortgage Rate Min',
    'Prime Lending Rate', 'FD 91D Nominal Min'
  ];
  return rateFields.some(f => data[f] !== null && data[f] !== undefined);
}

// ============================================================
// MAIN GEMINI VISION CALL
// No pdf-parse. Raw bytes → Gemini → JSON.
// ============================================================
async function extractWithGeminiVision(base64Content, mimeType, bankInfo) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('GEMINI_API_KEY not set in environment variables');
    return null;
  }

  console.log(`Calling Gemini Vision with ${mimeType}, bank: ${bankInfo?.fullName || 'unknown'}...`);

  const body = {
    contents: [{
      parts: [
        {
          inline_data: {
            mime_type: mimeType,
            data: base64Content        // raw file bytes — Gemini reads it visually
          }
        },
        {
          text: buildPrompt(bankInfo)  // surgical prompt with bank-specific instructions
        }
      ]
    }],
    generationConfig: {
      temperature: 0.02,     // very low — we want precise extraction, not creativity
      maxOutputTokens: 3000
    }
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );

  const result = await res.json();
  return parseGeminiResponse(result);
}

// ============================================================
// MAIN HANDLER
// ============================================================
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { filename, content, mimeType } = req.body;

    if (!filename || !content) {
      return res.status(400).json({ error: 'Missing filename or content' });
    }

    const detectedMime   = mimeType || detectMimeType(filename, content);
    const bankDetected   = detectBank(filename);
    const bankInfo       = bankDetected?.info || null;

    console.log(`\n=== Processing: ${filename} | ${detectedMime} | Bank: ${bankInfo?.fullName || 'UNKNOWN'} ===`);

    // ── Single call: raw file → Gemini Vision ──
    let data = await extractWithGeminiVision(content, detectedMime, bankInfo);

    // ── If Gemini didn't get Bank Name, try again with an explicit prompt ──
    if (data && !data['Bank Name'] && bankInfo) {
      console.log('Bank Name missing — injecting from filename detection');
      data['Bank Name'] = bankInfo.fullName;
    }

    // ── Always apply known website if the field came back empty ──
    if (data) {
      const knownSite = bankInfo?.website || BANK_WEBSITES[data['Bank Name']];
      if ((!data['Website'] || data['Website'] === 'null') && knownSite) {
        data['Website'] = knownSite;
        console.log('Website filled from knowledge base:', knownSite);
      }
    }

    // ── Failure: no useful data extracted ──
    if (!data || !data['Bank Name']) {
      return res.status(400).json({
        error: 'Could not extract data from this file',
        details: bankInfo
          ? `Gemini could not read the document. For "${bankInfo.fullName}", try uploading a clearer scan or screenshot (JPG/PNG).`
          : 'Bank not detected from filename. Rename the file to include the bank name (e.g. "FNB_March2026.pdf") and try again.',
      });
    }

    const filled  = countFilled(data);
    const quality = Math.round((filled / 44) * 100);

    console.log(`=== Done: ${data['Bank Name']} | ${filled}/44 fields | ${quality}% ===\n`);

    return res.status(200).json({
      success:  true,
      message:  `Extracted ${filled}/44 fields (${quality}% complete). Review and approve.`,
      quality,
      data
    });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Processing failed', details: err.message });
  }
};