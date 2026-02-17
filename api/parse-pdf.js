// ============================================================
// BW RATE WATCH — PDF PARSER (PURE GEMINI VISION)
// 100% FREE — Uses Gemini 1.5 Flash with vision
// Sends raw file bytes via inline_data (no pdf-parse)
// ============================================================

const BANK_KNOWLEDGE = {
  ABSA: {
    aliases: ['absa'],
    fullName: 'ABSA Bank Botswana',
    website: 'https://www.absa.co.bw',
    hints: 'PLR 6.76%. FD table has BLANK row labels (they float above). Map by position: Row1=3M (1.46%), Row2=6M (1.73-1.90%), Row3=12M (2.57-3.07%), Row4=24M (2.92-3.62%), Row5=Over24M (3.02-3.82%). Mortgage 17.26-20.76%, Personal 21.26-30.76%, Credit Card 24-36%.'
  },
  ACCESS: {
    aliases: ['access'],
    fullName: 'Access Bank Botswana',
    website: 'https://botswana.accessbankplc.com',
    hints: 'PLR 7.16% (called ABB Prime). TWO tables side-by-side: use LEFT (BWP) only, ignore right (foreign currency). 91Day FD exists. Mortgage 7.66-17.16%, Personal 8.16-32.16%, Credit Card 0-32%.'
  },
  BSB: {
    aliases: ['bsb', 'botswana savings'],
    fullName: 'Botswana Savings Bank (BSB)',
    website: 'https://www.bsb.bw',
    hints: 'PLR 8.01%. SAYE product 1.25-2.00%. Eezi Auto (car loan) 11.51-16.01%. Mortgage 8.01-13.01%, Personal 20.01-30.01%. Phone 367 0100, Website www.bsb.bw'
  },
  BBS: {
    aliases: ['bbs'],
    fullName: 'BBS Bank',
    website: 'https://www.bbs.co.bw',
    hints: 'Image-based PDF. Look carefully at entire document for rate table.'
  },
  FNB: {
    aliases: ['fnb', 'first national'],
    fullName: 'FNB Botswana',
    website: 'https://www.fnbbotswana.co.bw',
    hints: 'First National Bank Botswana'
  },
  STANBIC: {
    aliases: ['stanbic'],
    fullName: 'Stanbic Bank Botswana',
    website: 'https://www.stanbicbank.co.bw',
    hints: 'Standard Bank Group'
  },
  STANDARD_CHARTERED: {
    aliases: ['standard chartered', 'sc bank'],
    fullName: 'Standard Chartered Botswana',
    website: 'https://www.sc.com/bw',
    hints: 'SC Bank'
  },
  BANK_GABORONE: {
    aliases: ['bank gaborone', 'bankg'],
    fullName: 'Bank Gaborone',
    website: 'https://www.bankg.co.bw',
    hints: 'Local bank'
  }
};

function detectBank(filename) {
  const lower = (filename || '').toLowerCase();
  for (const [key, info] of Object.entries(BANK_KNOWLEDGE)) {
    if (info.aliases.some(a => lower.includes(a))) return info;
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

function cleanJSON(text) {
  if (!text) return null;
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

function buildPrompt(bankInfo) {
  const context = bankInfo 
    ? `\nCONTEXT: This is ${bankInfo.fullName}. ${bankInfo.hints}\n`
    : '';

  return `Read this Botswana bank document VISUALLY and extract all interest rates. Return ONLY valid JSON.
${context}
CRITICAL RULES:
1. All rates = plain numbers (8.01 not "8.01%" not "Prime+2")
2. For "PLR + X%" or "Prime + X%": calculate final (PLR=8.01, +5% → 13.01)
3. N/A, Nil, Negotiable → null
4. "Nominal" ≠ "Effective" — extract both
5. "91 Day" ≠ "3 Month" — different products
6. "Over 24 Months" ≠ "24 Months"
7. Ignore ZAR/USD/GBP/EUR — BWP only
8. Min balance = number only (1000 not "P1,000")
9. Look EVERYWHERE for Website and Contact Phone (header, footer, small print)

Return EXACTLY this JSON (null for missing):
{
  "Bank Name": "",
  "Data Month": "",
  "MoPR": 3.50,
  "Prime Lending Rate": null,
  "Website": "",
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
  "FD Minimum Balance": null,
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

// ════════════════════════════════════════════════════════════
// GEMINI VISION API CALL
// Sends raw file bytes via inline_data — no text extraction
// ════════════════════════════════════════════════════════════
async function callGeminiVision(base64Content, mimeType, prompt) {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error(
      'GEMINI_API_KEY is missing. Go to Vercel Dashboard → Your Project → Settings → ' +
      'Environment Variables → Add New → Name: GEMINI_API_KEY, Value: your key from ' +
      'https://aistudio.google.com/app/apikey (it\'s free). Then redeploy.'
    );
  }

  console.log('[Gemini Vision] Calling...');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Content  // Raw file bytes — Gemini reads it visually
              }
            },
            {
              text: prompt
            }
          ]
        }],
        generationConfig: {
          temperature: 0.05,
          maxOutputTokens: 4096
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API ${response.status}: ${errorText.substring(0, 300)}`);
  }

  const result = await response.json();

  if (result.error) {
    throw new Error(`Gemini error: ${result.error.message}`);
  }

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) {
    const reason = result.candidates?.[0]?.finishReason || 'unknown';
    throw new Error(`Gemini returned empty response (finish reason: ${reason})`);
  }

  console.log('[Gemini Vision] Success');
  return cleanJSON(text);
}

// ════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { filename, content } = req.body || {};

    if (!filename || !content) {
      return res.status(400).json({ 
        error: 'Missing filename or content',
        hint: 'Upload a PDF, JPG, or PNG file'
      });
    }

    const mimeType = detectMimeType(filename);
    const bankInfo = detectBank(filename);
    const prompt = buildPrompt(bankInfo);

    console.log(`\n=== ${filename} | ${mimeType} | ${bankInfo?.fullName || 'Unknown Bank'} ===`);

    // Call Gemini Vision
    let data = await callGeminiVision(content, mimeType, prompt);

    if (!data) {
      throw new Error('Failed to parse Gemini response');
    }

    // Apply fallbacks from knowledge base
    if (!data['Bank Name'] && bankInfo) {
      data['Bank Name'] = bankInfo.fullName;
    }
    if (bankInfo?.website && (!data['Website'] || data['Website'] === 'null')) {
      data['Website'] = bankInfo.website;
    }

    const filled = countFilled(data);
    const quality = Math.round((filled / 44) * 100);

    console.log(`=== Done: ${data['Bank Name']} | ${filled}/44 fields | ${quality}% ===\n`);

    return res.status(200).json({
      success: true,
      message: `Extracted ${filled}/44 fields (${quality}% complete)`,
      quality,
      data
    });

  } catch (error) {
    console.error('Error:', error);
    
    return res.status(500).json({
      error: 'Extraction failed',
      details: error.message,
      hint: error.message.includes('GEMINI_API_KEY')
        ? 'Add GEMINI_API_KEY to Vercel environment variables (free key from https://aistudio.google.com/app/apikey)'
        : 'Try uploading a clearer PDF or rename file to include bank name (e.g. ABSA_Jan2026.pdf)'
    });
  }
};
