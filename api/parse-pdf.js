const pdf = require('pdf-parse');

// FREE Google Gemini AI extraction
async function extractWithGemini(base64Content) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
        console.log('No Gemini API key found');
        return null;
    }
    
    try {
        // Convert base64 PDF to text first (Gemini doesn't read PDFs directly)
        const pdfBuffer = Buffer.from(base64Content, 'base64');
        const pdfData = await pdf(pdfBuffer);
        const text = pdfData.text;
        
        if (!text || text.length < 100) {
            console.log('PDF text too short or empty');
            return null;
        }
        
        console.log('Extracted PDF text, length:', text.length);
        
        // Send to Gemini for intelligent extraction
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You are a bank rate extraction expert. Extract ALL interest rates from this bank document and return ONLY valid JSON.

Document text:
${text.substring(0, 8000)}

Return this exact JSON structure. Use exact Airtable field names as keys:
{
  "Bank Name": "string",
  "Report Period": "string",
  "MoPR": 0.00,
  "Prime Lending Rate": 0.00,
  "Current Account Rate": 0.00,
  "Call Account Min": 0.00,
  "Call Account Max": 0.00,
  "Savings Min": 0.00,
  "Savings Max": 0.00,
  "FD 3M Nominal Min": 0.00,
  "FD 3M Nominal Max": 0.00,
  "FD 6M Nominal Min": 0.00,
  "FD 6M Nominal Max": 0.00,
  "FD 12M Nominal Min": 0.00,
  "FD 12M Nominal Max": 0.00,
  "FD 24M Nominal Min": 0.00,
  "FD 24M Nominal Max": 0.00,
  "FD Minimum Balance": 0,
  "USD FD 12M Min": 0.00,
  "USD FD 12M Max": 0.00,
  "ZAR FD 12M Min": 0.00,
  "ZAR FD 12M Max": 0.00,
  "Mortgage Rate Min": "string (e.g. Prime + 2%)",
  "Mortgage Rate Max": "string",
  "Credit Card Rate Min": 0.00,
  "Credit Card Rate Max": 0.00,
  "Personal Loan Min": "string",
  "Personal Loan Max": "string",
  "Contact Phone": "string",
  "Website": "string",
  "Notes": "string"
}

CRITICAL: For 'Number' fields, return only the number (e.g., 7.01). For 'Mortgage' and 'Personal Loan' fields, you can include 'Prime +'. Return ONLY JSON.`
                    }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2048
                }
            })
        });
        
        const result = await response.json();
        
        if (result.candidates && result.candidates[0] && result.candidates[0].content) {
            let jsonText = result.candidates[0].content.parts[0].text.trim();
            
            // Clean up markdown formatting
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            
            // Find JSON object in response
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const extracted = JSON.parse(jsonMatch[0]);
                console.log('✅ Gemini extracted:', Object.keys(extracted).length, 'fields');
                return extracted;
            }
        }
        
        console.log('Gemini response:', JSON.stringify(result).substring(0, 500));
        return null;
        
    } catch (error) {
        console.error('Gemini extraction failed:', error.message);
        return null;
    }
}

// Smart regex extraction (enhanced)
async function extractWithRegex(text, filename) {
    console.log('Using smart regex extraction');
    
    const data = {
        'Bank Name': null,
        'Report Period': null,
        'MoPR': null,
        'Prime Lending Rate': null,
        'Call Account Min': null,
        'Call Account Max': null,
        'Savings Min': null,
        'Savings Max': null,
        'FD 3M Nominal Min': null,
        'FD 3M Nominal Max': null,
        'FD 6M Nominal Min': null,
        'FD 6M Nominal Max': null,
        'FD 12M Nominal Min': null,
        'FD 12M Nominal Max': null,
        'FD 24M Nominal Min': null,
        'FD 24M Nominal Max': null,
        'Mortgage Rate Min': null,
        'Mortgage Rate Max': null,
        'Credit Card Rate Min': null,
        'Credit Card Rate Max': null,
        'Personal Loan Min': null,
        'Personal Loan Max': null,
        'Contact Phone': null,
        'Website': null
    };
    
    // Bank name detection (comprehensive)
    const bankPatterns = {
        'fnb|first national': 'FNB Botswana',
        'stanbic': 'Stanbic Bank Botswana',
        'access bank': 'Access Bank Botswana',
        'absa': 'Absa Bank Botswana',
        'standard chartered': 'Standard Chartered Botswana',
        'bank gaborone|bg bank': 'Bank Gaborone',
        'baroda': 'Bank of Baroda Botswana',
        'banc ?abc': 'BancABC Botswana',
        'first capital': 'First Capital Bank Botswana'
    };
    
    for (const [pattern, bankName] of Object.entries(bankPatterns)) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(filename) || regex.test(text)) {
            data['Bank Name'] = bankName;
            break;
        }
    }
    
    // If still not found, try extracting from text
    if (!data['Bank Name']) {
        const match = text.match(/([A-Z][a-z]+\s+(?:Bank|Financial|Capital|Trust)(?:\s+[A-Z][a-z]+)?)/);
        if (match) data['Bank Name'] = match[0];
    }
    
    // Date/Period extraction
    const datePatterns = [
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s+202\d/i,
        /Effective\s+(?:from\s+)?(\d+\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+202\d)/i,
        /(\d{1,2}[-\/]\d{1,2}[-\/]202\d)/
    ];
    
    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
            data['Report Period'] = match[1] || match[0];
            break;
        }
    }
    
    // Enhanced rate extraction
    function extractRate(patterns, allowRange = true) {
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const numbers = match[0].match(/\d+\.?\d*/g);
                if (numbers && numbers.length > 0) {
                    const nums = numbers.map(n => parseFloat(n)).filter(n => !isNaN(n) && n < 100);
                    if (nums.length === 0) continue;
                    
                    if (allowRange && nums.length >= 2) {
                        return { min: Math.min(...nums), max: Math.max(...nums) };
                    } else {
                        const val = nums[nums.length - 1]; // Take last number
                        return { min: val, max: val };
                    }
                }
            }
        }
        return null;
    }
    
    // MoPR
    const mopr = extractRate([
        /MoPR[:\s]*(\d+\.?\d*)/i,
        /Monetary\s+Policy\s+Rate[:\s]*(\d+\.?\d*)/i,
        /Policy\s+Rate[:\s]*(\d+\.?\d*)/i
    ], false);
    if (mopr) data['MoPR'] = mopr.max;
    
    // Prime Rate
    const prime = extractRate([
        /Prime\s+Lending\s+Rate[:\s]*(\d+\.?\d*)/i,
        /Prime\s+Rate[:\s]*(\d+\.?\d*)/i,
        /PLR[:\s]*(\d+\.?\d*)/i
    ], false);
    if (prime) data['Prime Lending Rate'] = prime.max;
    
    // Call Account
    const call = extractRate([
        /Call\s+Account[^\d]*(\d+\.?\d*)[^\d]*[-–to]*[^\d]*(\d+\.?\d*)/i,
        /Call[^\d]*(\d+\.?\d*)[^\d]*[-–]*[^\d]*(\d+\.?\d*)/i
    ]);
    if (call) {
        data['Call Account Min'] = call.min;
        data['Call Account Max'] = call.max;
    }
    
    // Savings
    const savings = extractRate([
        /Savings\s+Account[^\d]*(\d+\.?\d*)[^\d]*[-–to]*[^\d]*(\d+\.?\d*)/i,
        /Savings[^\d]*(\d+\.?\d*)[^\d]*[-–]*[^\d]*(\d+\.?\d*)/i
    ]);
    if (savings) {
        data['Savings Min'] = savings.min;
        data['Savings Max'] = savings.max;
    }
    
    // Fixed Deposits - 3 Months
    const fd3 = extractRate([
        /3\s*(?:Month|M|Months)\s+Fixed[^\d]*(\d+\.?\d*)[^\d]*[-–]*[^\d]*(\d+\.?\d*)/i,
        /91\s*Day[^\d]*(\d+\.?\d*)[^\d]*[-–]*[^\d]*(\d+\.?\d*)/i,
        /Fixed.*?3.*?(?:Month|M)[^\d]*(\d+\.?\d*)[^\d]*[-–]*[^\d]*(\d+\.?\d*)/i
    ]);
    if (fd3) {
        data['FD 3M Nominal Min'] = fd3.min;
        data['FD 3M Nominal Max'] = fd3.max;
    }
    
    // Fixed Deposits - 6 Months
    const fd6 = extractRate([
        /6\s*(?:Month|M|Months)\s+Fixed[^\d]*(\d+\.?\d*)[^\d]*[-–]*[^\d]*(\d+\.?\d*)/i,
        /Fixed.*?6.*?(?:Month|M)[^\d]*(\d+\.?\d*)[^\d]*[-–]*[^\d]*(\d+\.?\d*)/i
    ]);
    if (fd6) {
        data['FD 6M Nominal Min'] = fd6.min;
        data['FD 6M Nominal Max'] = fd6.max;
    }
    
    // Fixed Deposits - 12 Months
    const fd12 = extractRate([
        /12\s*(?:Month|M|Months)\s+Fixed[^\d]*(\d+\.?\d*)[^\d]*[-–]*[^\d]*(\d+\.?\d*)/i,
        /Fixed.*?12.*?(?:Month|M)[^\d]*(\d+\.?\d*)[^\d]*[-–]*[^\d]*(\d+\.?\d*)/i,
        /(?:One|1)\s+Year.*?Fixed[^\d]*(\d+\.?\d*)[^\d]*[-–]*[^\d]*(\d+\.?\d*)/i
    ]);
    if (fd12) {
        data['FD 12M Nominal Min'] = fd12.min;
        data['FD 12M Nominal Max'] = fd12.max;
    }
    
    // Fixed Deposits - 24 Months
    const fd24 = extractRate([
        /24\s*(?:Month|M|Months)\s+Fixed[^\d]*(\d+\.?\d*)[^\d]*[-–]*[^\d]*(\d+\.?\d*)/i,
        /Fixed.*?24.*?(?:Month|M)[^\d]*(\d+\.?\d*)[^\d]*[-–]*[^\d]*(\d+\.?\d*)/i,
        /(?:Two|2)\s+Year.*?Fixed[^\d]*(\d+\.?\d*)[^\d]*[-–]*[^\d]*(\d+\.?\d*)/i
    ]);
    if (fd24) {
        data['FD 24M Nominal Min'] = fd24.min;
        data['FD 24M Nominal Max'] = fd24.max;
    }
    
    // Mortgage
    const mortgage = extractRate([
        /Mortgage[^\d]*(\d+\.?\d*)[^\d]*[-–]*[^\d]*(\d+\.?\d*)/i,
        /Home\s+Loan[^\d]*(\d+\.?\d*)[^\d]*[-–]*[^\d]*(\d+\.?\d*)/i
    ]);
    if (mortgage) {
        data['Mortgage Rate Min'] = mortgage.min;
        data['Mortgage Rate Max'] = mortgage.max;
    } else {
        // Check for Prime + format
        const mortgagePrime = text.match(/Mortgage[^\n]*Prime\s*\+\s*(\d+)%?\s*[-–to]*\s*Prime\s*\+\s*(\d+)%?/i);
        if (mortgagePrime) {
            data['Mortgage Rate Min'] = `Prime +${mortgagePrime[1]}%`;
            data['Mortgage Rate Max'] = `Prime +${mortgagePrime[2]}%`;
        }
    }
    
    // Credit Card
    const cc = extractRate([
        /Credit\s+Card[^\d]*(\d+)[^\d]*[-–]*[^\d]*(\d+)/i
    ]);
    if (cc) {
        data['Credit Card Rate Min'] = cc.min;
        data['Credit Card Rate Max'] = cc.max;
    }
    
    // Personal Loan
    const personal = extractRate([
        /Personal\s+Loan[^\d]*(\d+\.?\d*)[^\d]*[-–]*[^\d]*(\d+\.?\d*)/i,
        /Unsecured.*?Loan[^\d]*(\d+\.?\d*)[^\d]*[-–]*[^\d]*(\d+\.?\d*)/i
    ]);
    if (personal) {
        data['Personal Loan Min'] = personal.min;
        data['Personal Loan Max'] = personal.max;
    } else {
        const personalPrime = text.match(/Personal\s+Loan[^\n]*Prime\s*\+\s*(\d+)%?\s*[-–to]*\s*Prime\s*\+\s*(\d+)%?/i);
        if (personalPrime) {
            data['Personal Loan Min'] = `Prime +${personalPrime[1]}%`;
            data['Personal Loan Max'] = `Prime +${personalPrime[2]}%`;
        }
    }
    
    // Contact Phone
    const phonePatterns = [
        /(?:Tel|Phone|Contact)[:\s]*([+]?267[-\s]?\d{3,4}[-\s]?\d{3,4})/i,
        /(?:Tel|Phone|Contact)[:\s]*(\d{3,4}[-\s]?\d{3,4})/i
    ];
    for (const pattern of phonePatterns) {
        const match = text.match(pattern);
        if (match) {
            data['Contact Phone'] = match[1].trim();
            break;
        }
    }
    
    // Website
    const webPatterns = [
        /(www\.[a-z0-9.-]+\.co\.bw)/i,
        /(https?:\/\/[a-z0-9.-]+\.co\.bw)/i
    ];
    for (const pattern of webPatterns) {
        const match = text.match(pattern);
        if (match) {
            data['Website'] = match[1].startsWith('http') ? match[1] : 'https://' + match[1];
            break;
        }
    }
    
    return data;
}

async function updateAirtable(data) {
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const tableName = 'Bank Interest Rates';
    
    const finalData = {
        ...data,
        'Last Updated': new Date().toISOString().split('T')[0],
        'Auto Updated': true,
        'Data Source': 'PDF Upload'
    };
    
    const fields = {};
    for (const [key, value] of Object.entries(finalData)) {
        if (value !== null && value !== undefined && value !== '') {
            fields[key] = value;
        }
    }
    
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}?filterByFormula={Bank Name}="${encodeURIComponent(fields['Bank Name'])}"`;
    
    const searchResponse = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
    });
    
    const searchData = await searchResponse.json();
    
    if (searchData.records && searchData.records.length > 0) {
        const recordId = searchData.records[0].id;
        const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}/${recordId}`;
        
        await fetch(updateUrl, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields })
        });
        
        console.log('✅ Updated:', fields['Bank Name']);
        return { action: 'updated', bank: fields['Bank Name'] };
    } else {
        const createUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}`;
        
        await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields })
        });
        
        console.log('✅ Created:', fields['Bank Name']);
        return { action: 'created', bank: fields['Bank Name'] };
    }
}

module.exports = async (req, res) => {
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
        const { filename, content } = req.body;
        
        if (!filename || !content) {
            return res.status(400).json({ error: 'Missing filename or content' });
        }
        
        console.log('📄 Processing:', filename);
        
        let extractedData = null;
        
        // Try AI extraction with Gemini (FREE)
        extractedData = await extractWithGemini(content);
        
        // Fallback to enhanced regex
        if (!extractedData || !extractedData['Bank Name']) {
            console.log('Trying regex extraction...');
            const pdfBuffer = Buffer.from(content, 'base64');
            const pdfData = await pdf(pdfBuffer);
            extractedData = await extractWithRegex(pdfData.text, filename);
        }
        
        if (!extractedData || !extractedData['Bank Name']) {
            return res.status(400).json({ 
                error: 'Could not extract bank rates from PDF',
                hint: 'Try renaming file to include bank name (e.g., "FNB_Rates_Jan2026.pdf") or use manual entry'
            });
        }
        
        // We removed the automatic updateAirtable call. 
        // Data is now sent back to the Admin Dashboard for your approval first.
        res.status(200).json({ 
            success: true, 
            message: `✅ Extracted data from ${filename}. Please review and approve.`,
            data: extractedData
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ 
            error: 'Processing failed',
            details: error.message
        });
    }
};