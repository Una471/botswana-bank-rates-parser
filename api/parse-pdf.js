// ============================================================
// BW RATE WATCH — PDF PARSER v4
// Primary:  Gemini Vision (raw bytes → inline_data → JSON)
// Fallback: pdf-parse text → Gemini text prompt
// Both paths use the same bank-specific surgical prompt.
// If Gemini API key is missing, falls back to regex extraction.
// ============================================================

const pdf = require('pdf-parse');

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
- PLR: "Absa PLR" = 6.76% (may render as "6. %" due to a gap — correct value is 6.76)
- DEPOSIT TABLE — BWP section only (ignore ZAR/GBP/USD tables):
  Current: 0.00% - 1.00% nominal
  Call:    0.00% - 0.55% nominal / 0.00% - 0.55% effective
  Savings: 0.00% - 3.60% nominal / 0.00% - 3.66% effective
  FIXED DEPOSITS — 5 rows below Savings have BLANK first cells.
  Map by row position (labels float visually above the table):
    Row 1 = 3 Months:   1.46% nominal,       1.47% effective
    Row 2 = 6 Months:   1.73%-1.90% nominal,  1.74%-1.91% effective
    Row 3 = 12 Months:  2.57%-3.07% nominal,  2.57%-3.07% effective
    Row 4 = 24 Months:  2.92%-3.62% nominal,  2.92%-3.62% effective
    Row 5 = Over 24M:   3.02%-3.82% nominal,  3.02%-3.82% effective
- LENDING TABLE (final rates — add spread to Absa PLR 6.76):
  MoPR = 3.50
  Mortgage:      Absa PLR+10.50% to Absa PLR+14%   → 17.26 to 20.76
  Overdraft:     Absa PLR+10% to Absa PLR+20%       → 16.76 to 26.76
  Credit Card:   24% to 36% (direct — no PLR)
  Lease (VAF):   Absa PLR+11.75% to Absa PLR+14%   → 18.51 to 20.76
  Personal Loan: Absa PLR+14.5% to Absa PLR+24%    → 21.26 to 30.76
  Other LT:      Negotiable → null
- Website: www.absa.co.bw → https://www.absa.co.bw`
  },

  ACCESS: {
    aliases: ['access'],
    fullName: 'Access Bank Botswana',
    website: 'https://botswana.accessbankplc.com',
    pdfStructure: `
ACCESS BANK SPECIFIC INSTRUCTIONS:
- PLR: "ABB Prime" = 7.16%
- DEPOSIT: TWO side-by-side tables. Use ONLY the LEFT (BWP) table. Ignore right-side FX table.
  Current:    Nil
  Call:       0.10%-0.60% nominal / 0.10%-0.60% effective (min P1,000)
  Savings:    0.15%-5.50% nominal / 0.15%-5.50% effective (min P100)
  91Day:      1.00%-3.50% nominal / 1.00%-3.50% effective (min P1,000) ← 91-day fixed deposit
  6 Months:   1.76%-4.01% nominal / 1.75%-4.00% effective (min P1,000)
  12 Months:  2.05%-6.25% nominal / 2.05%-6.25% effective (min P1,000)
  24 Months:  2.25%-6.25% nominal / 2.25%-6.25% effective (min P1,000)
  Over 24M:   2.55%-6.25% nominal / 2.55%-6.25% effective (min P1,000)
- LENDING TABLE (final rates — add spread to ABB Prime 7.16):
  MoPR = 3.50
  Mortgage:      ABB Prime+0.5% to ABB Prime+10%  → 7.66 to 17.16
  Overdraft:     ABB Prime+1% to ABB Prime+20%    → 8.16 to 27.16
  Credit Card:   Up to 32% → min=0, max=32
  Lease Loans:   ABB Prime+1% to ABB Prime+10%    → 8.16 to 17.16
  Personal Loan: ABB Prime+1% to ABB Prime+25%    → 8.16 to 32.16
  Other LT: Not Available → null
- Contact phone (in footer): 367 4600
- Website: https://botswana.accessbankplc.com`
  },

  BSB: {
    aliases: ['bsb', 'botswana savings'],
    fullName: 'Botswana Savings Bank (BSB)',
    website: 'https://www.bsb.bw',
    pdfStructure: `
BSB (BOTSWANA SAVINGS BANK) SPECIFIC INSTRUCTIONS:
- PLR = 8.01%
- DEPOSIT TABLE: Type | Nominal (Lowest-Highest) | Actual/Effective (Lowest-Highest) | Min Balance (Pula)
  Current: NIL
  Savings sub-products:
    Sesigo:   1.75%-2.75% nominal, 1.76%-2.78% effective (min P200)
    Ordinary: 1.75% nominal,       1.76% effective         (min P50)
    SAYE:     1.25%-2.00% nominal, 1.26%-2.02% effective  (min P200)
  Use for Savings fields: min=1.25, max=2.75 (overall range)
  Use for SAYE fields:    min=1.25, max=2.00, eff_min=1.26, eff_max=2.02
  Fixed Deposits (all min P1,000):
    3 months:  0.80%-1.00% nominal, 0.80%-1.00% effective
    6 months:  1.40%-1.75% nominal, 1.41%-1.76% effective
    12 months: 1.85%-2.20% nominal, 1.87%-2.22% effective
    24 months: 2.25%-2.55% nominal, 2.27%-2.58% effective
    Over 24M:  3.35%-3.80% nominal, 3.40%-3.87% effective
- LENDING TABLE (final rates — add spread to Prime 8.01):
  MoPR = 3.50
  Mortgage:   "Prime to Prime + 5.00%" → min=8.01, max=13.01
  Overdraft:  N/A → null
  Credit Card: N/A → null
  Eezi Auto (= CAR LOAN): Prime+3.50% to Prime+8.0% → 11.51 to 16.01
  Lease Loans: N/A → null
  Personal Loan: Prime+12% to Prime+22% → 20.01 to 30.01
  Other LT: N/A → null
- Contact phone (in footer): 367 0100 (may show as "36 7 0100")
- Website (in footer): www.bsb.bw → https://www.bsb.bw`
  },

  BBS: {
    aliases: ['bbs'],
    fullName: 'BBS Bank',
    website: 'https://www.bbs.co.bw',
    pdfStructure: `
BBS BANK SPECIFIC INSTRUCTIONS:
- IMAGE-BASED document — all content is drawn as graphics, not selectable text.
- Read the entire image carefully: look for a rate schedule table.
- Report period: December 2025
- Website: https://www.bbs.co.bw`
  },

  FNB: {
    aliases: ['fnb', 'first national'],
    fullName: 'FNB Botswana',
    website: 'https://www.fnbbotswana.co.bw',
    pdfStructure: `
FNB BOTSWANA SPECIFIC INSTRUCTIONS:
- First National Bank Botswana
- Products: Cheque/Current, Smart Savings, Gold Account, Fixed Deposits, e-Savings
- Lending: Home Loans (mortgage), Personal Loans, Overdraft
- Calculate all PLR+ lending rates to final values
- Website: fnbbotswana.co.bw`
  },

  STANBIC: {
    aliases: ['stanbic'],
    fullName: 'Stanbic Bank Botswana',
    website: 'https://www.stanbicbank.co.bw',
    pdfStructure: `
STANBIC BANK BOTSWANA: Calculate all PLR+ lending rates to final values. Website: stanbicbank.co.bw`
  },

  STANDARD_CHARTERED: {
    aliases: ['standard chartered', 'sc bank'],
    fullName: 'Standard Chartered Botswana',
    website: 'https://www.sc.com/bw',
    pdfStructure: `
STANDARD CHARTERED BOTSWANA: Calculate all PLR+ lending rates. Website: sc.com/bw`
  },

  BANK_GABORONE: {
    aliases: ['bank gaborone', 'bankg', 'bg bank'],
    fullName: 'Bank Gaborone',
    website: 'https://www.bankg.co.bw',
    pdfStructure: `BANK GABORONE: Calculate all PLR+ lending rates. Website: bankg.co.bw`
  },

  BARODA: {
    aliases: ['baroda', 'bank of baroda'],
    fullName: 'Bank of Baroda Botswana',
    website: 'https://www.bankofbaroda.co.bw',
    pdfStructure: `BANK OF BARODA BOTSWANA: Calculate all PLR+ lending rates.`
  },

  FIRST_CAPITAL: {
    aliases: ['first capital'],
    fullName: 'First Capital Bank Botswana',
    website: 'https://www.firstcapitalbank.co.bw',
    pdfStructure: `FIRST CAPITAL BANK BOTSWANA: Calculate all PLR+ lending rates.`
  },

  BANCABC: {
    aliases: ['bancabc', 'banc abc', 'african banking'],
    fullName: 'BancABC Botswana',
    website: 'https://www.bancabc.co.bw',
    pdfStructure: `BANCABC BOTSWANA: Calculate all PLR+ lending rates. Website: bancabc.co.bw`
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

// ============================================================
// BUILD SURGICAL GEMINI PROMPT
// ============================================================
function buildPrompt(bankInfo, mode, pdfText) {
  const bankSection = bankInfo
    ? `\nBANK-SPECIFIC KNOWLEDGE:\n${bankInfo.pdfStructure}\n`
    : '';

  const textSection = (mode === 'text' && pdfText)
    ? `\nEXTRACTED PDF TEXT (layout may be scrambled — use bank-specific knowledge above to match values to correct fields):\n---\n${pdfText.substring(0, 8000)}\n---`
    : '';

  return `You are extracting Botswana bank interest rates. Return ONLY valid JSON — no markdown, no explanation.

RULES:
1. All rates must be plain NUMBERS (e.g. 8.01 — not "8.01%" not "Prime+2")
2. Lending rates with "Prime + X%" or "PLR + X%": ADD spread to PLR for final value.
   Example: PLR=8.01, spread=+5% → 13.01. PLR=6.76, spread=+14% → 20.76
3. "Prime to Prime + 5%" means min=PLR (e.g. 8.01), max=PLR+5 (e.g. 13.01)
4. N/A, Nil, Not Available, Negotiable → null
5. Nominal and Effective/Actual are DIFFERENT — extract both
6. "91 Day" and "3 Month" are DIFFERENT products
7. "Over 24 Months" ≠ "24 Months"
8. Ignore ZAR/USD/GBP/EUR — BWP (Botswana Pula) only
9. Min balance: number only (1000 not "P1,000")
10. WEBSITE: Check the ENTIRE document — header, footer, bottom, small print.
    Format as https://www.domain.co.bw. ${bankInfo ? `Known website: ${bankInfo.website}` : ''}
11. CONTACT PHONE: Look in footer/contact section.
${bankSection}${textSection}

Return this EXACT JSON structure (null for missing/N/A fields):
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
}`;
}

// ============================================================
// CALL GEMINI — shared fetch logic
// ============================================================
async function callGemini(parts, bankInfo, mode, pdfText) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY environment variable is not set in Vercel. Go to Vercel → Project Settings → Environment Variables and add it.');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.02, maxOutputTokens: 3000 }
      })
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API returned ${res.status}: ${errBody.substring(0, 300)}`);
  }

  const result = await res.json();

  if (result.error) {
    throw new Error(`Gemini error: ${result.error.message}`);
  }

  const raw = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) {
    const reason = result.candidates?.[0]?.finishReason || 'unknown';
    throw new Error(`Gemini returned empty response (finishReason: ${reason})`);
  }

  // Parse JSON from response
  const clean = raw.trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Gemini response had no JSON object. Raw: ${raw.substring(0, 200)}`);

  return JSON.parse(match[0]);
}

// ============================================================
// METHOD 1: VISION — send raw file bytes to Gemini
// Works for: image PDFs, vector PDFs, JPG, PNG, text PDFs
// ============================================================
async function extractVision(base64Content, mimeType, bankInfo) {
  console.log(`[Vision] Sending ${mimeType} to Gemini...`);
  const parts = [
    { inline_data: { mime_type: mimeType, data: base64Content } },
    { text: buildPrompt(bankInfo, 'vision', null) }
  ];
  const data = await callGemini(parts, bankInfo, 'vision', null);
  console.log(`[Vision] Extracted ${countFilled(data)} fields`);
  return data;
}

// ============================================================
// METHOD 2: TEXT — extract text via pdf-parse, send to Gemini
// Fallback for when Vision fails (network error, size limit)
// ============================================================
async function extractText(pdfBuffer, bankInfo) {
  console.log('[Text] Extracting PDF text via pdf-parse...');
  const pdfData = await pdf(pdfBuffer);
  const text = pdfData.text || '';

  if (text.length < 50) {
    throw new Error('PDF text extraction returned almost no text (image-based PDF). Use Vision mode or upload a JPG screenshot instead.');
  }

  console.log(`[Text] Got ${text.length} chars, sending to Gemini...`);
  const parts = [{ text: buildPrompt(bankInfo, 'text', text) }];
  const data = await callGemini(parts, bankInfo, 'text', text);
  console.log(`[Text] Extracted ${countFilled(data)} fields`);
  return data;
}

// ============================================================
// HELPERS
// ============================================================
function countFilled(data) {
  if (!data) return 0;
  return Object.values(data).filter(v => v !== null && v !== undefined && v !== '').length;
}

function applyFallbacks(data, bankInfo) {
  if (!data) return data;
  // Fill in bank name from filename detection if Gemini missed it
  if (!data['Bank Name'] && bankInfo) {
    data['Bank Name'] = bankInfo.fullName;
  }
  // Fill in website from knowledge base if missing
  const knownSite = bankInfo?.website || BANK_WEBSITES[data['Bank Name']];
  if ((!data['Website'] || data['Website'] === 'null' || data['Website'] === 'null') && knownSite) {
    data['Website'] = knownSite;
  }
  return data;
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
      return res.status(400).json({ error: 'Missing filename or content in request body' });
    }

    const detectedMime = mimeType || detectMimeType(filename, content);
    const isImage      = detectedMime.startsWith('image/');
    const bankDetected = detectBank(filename);
    const bankInfo     = bankDetected?.info || null;

    console.log(`\n=== ${filename} | ${detectedMime} | ${bankInfo?.fullName || 'UNKNOWN BANK'} ===`);

    let data = null;
    let lastError = null;

    // ── ATTEMPT 1: Gemini Vision (handles everything) ──
    try {
      data = await extractVision(content, detectedMime, bankInfo);
      data = applyFallbacks(data, bankInfo);
    } catch (visionErr) {
      lastError = visionErr;
      console.error('[Vision] Failed:', visionErr.message);

      // ── ATTEMPT 2: pdf-parse + Gemini text (PDFs only, not images) ──
      if (!isImage) {
        try {
          console.log('[Fallback] Trying pdf-parse + text extraction...');
          const pdfBuffer = Buffer.from(content, 'base64');
          data = await extractText(pdfBuffer, bankInfo);
          data = applyFallbacks(data, bankInfo);
          lastError = null; // text worked
        } catch (textErr) {
          console.error('[Text] Failed:', textErr.message);
          // keep lastError as the vision error (more descriptive)
        }
      }
    }

    // ── Both failed ──
    if (!data || !data['Bank Name']) {
      const errorMessage = lastError
        ? lastError.message
        : 'Could not extract bank name from file';

      console.error('All extraction methods failed:', errorMessage);

      return res.status(400).json({
        error: 'Extraction failed',
        details: errorMessage,
        // Surface actionable hints
        hint: errorMessage.includes('GEMINI_API_KEY')
          ? 'Add GEMINI_API_KEY to your Vercel environment variables: Vercel Dashboard → Project → Settings → Environment Variables'
          : isImage
            ? 'Try uploading a clearer, higher-resolution screenshot'
            : 'Try renaming the file to include the bank name (e.g. ABSA_Jan2026.pdf) or upload a JPG screenshot instead',
      });
    }

    const filled  = countFilled(data);
    const quality = Math.round((filled / 44) * 100);

    console.log(`=== Done: ${data['Bank Name']} | ${filled}/44 fields | ${quality}% ===\n`);

    return res.status(200).json({
      success:  true,
      message:  `Extracted ${filled}/44 fields (${quality}% complete). Review and approve.`,
      quality,
      data,
    });

  } catch (err) {
    console.error('Unhandled error:', err);
    return res.status(500).json({
      error:   'Server error',
      details: err.message,
    });
  }
};
