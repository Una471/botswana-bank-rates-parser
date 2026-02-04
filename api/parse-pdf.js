const pdf = require('pdf-parse');

async function extractBankRates(text, filename) {
    console.log('Extracting from PDF, first 300 chars:', text.substring(0, 300));
    
    const data = {
        'Bank Name': null,
        'Report Period': null,
        'Last Updated': new Date().toISOString().split('T')[0],
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
        'Website': null,
        'Auto Updated': true,
        'Data Source': 'PDF Upload'
    };
    
    // 1. UNIVERSAL BANK NAME DETECTION
    const botswanaBanks = [
        'FNB Botswana', 'First National Bank Botswana',
        'Stanbic Bank Botswana', 'Stanbic Botswana',
        'Access Bank Botswana', 'Access Botswana',
        'Standard Chartered Botswana', 'Standard Chartered',
        'Absa Bank Botswana', 'Absa Botswana',
        'Bank of Botswana', 'BoB',
        'Bank Gaborone', 'BG',
        'Bank of Baroda Botswana',
        'BancABC Botswana',
        'First Capital Bank Botswana',
        'Bank SBI Botswana',
        'Bank of India Botswana'
    ];
    
    let detectedBank = null;
    
    // Check filename first
    const filenameLower = filename.toLowerCase();
    for (const bank of botswanaBanks) {
        const bankNameLower = bank.toLowerCase();
        const bankWords = bankNameLower.split(' ');
        if (filenameLower.includes(bankWords[0])) {
            detectedBank = bank;
            break;
        }
    }
    
    // Check text content
    if (!detectedBank) {
        for (const bank of botswanaBanks) {
            const pattern = new RegExp(`\\b${bank.split(' ')[0]}\\b`, 'i');
            if (pattern.test(text)) {
                detectedBank = bank;
                break;
            }
        }
    }
    
    // Generic bank detection
    if (!detectedBank) {
        const bankMatch = text.match(/(\b(?:Bank|Trust|Financial|Capital|Savings)\s+[\w\s]+\b)/i);
        if (bankMatch) {
            detectedBank = bankMatch[1].trim();
        }
    }
    
    // Fallback to filename
    if (!detectedBank) {
        const cleanName = filename
            .replace('.pdf', '')
            .replace(/\d+/g, '')
            .replace(/[_-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        detectedBank = cleanName || 'Unknown Bank';
    }
    
    data['Bank Name'] = detectedBank;
    
    // 2. REPORT PERIOD DETECTION
    const datePatterns = [
        /effective from (\d+(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
        /effective (\d+(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i,
        /\d{1,2}\/\d{1,2}\/\d{4}/,
        /\d{4}-\d{1,2}-\d{1,2}/
    ];
    
    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
            data['Report Period'] = match[1] || match[0];
            break;
        }
    }
    
    // Also check filename for date
    if (!data['Report Period']) {
        const filenameDateMatch = filename.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
        if (filenameDateMatch) {
            data['Report Period'] = `${filenameDateMatch[1]} ${filenameDateMatch[2]}`;
        }
    }
    
    // 3. RATE EXTRACTION FUNCTIONS
    function findSingleRate(pattern, defaultValue = null) {
        const match = text.match(pattern);
        return match ? parseFloat(match[1]) : defaultValue;
    }
    
    function findRateRange(pattern, defaultValue = null) {
        const match = text.match(pattern);
        if (match) {
            const min = parseFloat(match[1]);
            const max = match[2] ? parseFloat(match[2]) : min;
            return { min, max };
        }
        return defaultValue;
    }
    
    // 4. EXTRACT SPECIFIC RATES
    
    // MoPR / Policy Rate
    data['MoPR'] = findSingleRate(/(?:Monetary Policy Rate|MoPR|Policy Rate)[:\s]+(\d+\.?\d*)/i);
    
    // Prime Lending Rate
    data['Prime Lending Rate'] = findSingleRate(/(?:Prime Lending Rate|Prime Rate|Prime)[:\s]+(\d+\.?\d*)/i);
    
    // Call Account
    const callRange = findRateRange(/(?:Call Account|Call)[^0-9]*(\d+\.?\d*)%?\s*[-–]?\s*(\d+\.?\d*)?%/i);
    if (callRange) {
        data['Call Account Min'] = callRange.min;
        data['Call Account Max'] = callRange.max;
    }
    
    // Savings Account
    const savingsRange = findRateRange(/(?:Savings Account|Savings|Current)[^0-9]*(\d+\.?\d*)%?\s*[-–]?\s*(\d+\.?\d*)?%/i);
    if (savingsRange) {
        data['Savings Min'] = savingsRange.min;
        data['Savings Max'] = savingsRange.max;
    }
    
    // Fixed Deposit 3 Months
    const fd3Range = findRateRange(/(?:FD.*?3|Fixed.*?3.*?Month|91.*?Day)[^0-9]*(\d+\.?\d*)%?\s*[-–]?\s*(\d+\.?\d*)?%/i);
    if (fd3Range) {
        data['FD 3M Nominal Min'] = fd3Range.min;
        data['FD 3M Nominal Max'] = fd3Range.max;
    }
    
    // Fixed Deposit 6 Months
    const fd6Range = findRateRange(/(?:FD.*?6|Fixed.*?6.*?Month)[^0-9]*(\d+\.?\d*)%?\s*[-–]?\s*(\d+\.?\d*)?%/i);
    if (fd6Range) {
        data['FD 6M Nominal Min'] = fd6Range.min;
        data['FD 6M Nominal Max'] = fd6Range.max;
    }
    
    // Fixed Deposit 12 Months
    const fd12Range = findRateRange(/(?:FD.*?12|Fixed.*?12.*?Month)[^0-9]*(\d+\.?\d*)%?\s*[-–]?\s*(\d+\.?\d*)?%/i);
    if (fd12Range) {
        data['FD 12M Nominal Min'] = fd12Range.min;
        data['FD 12M Nominal Max'] = fd12Range.max;
    }
    
    // Fixed Deposit 24 Months
    const fd24Range = findRateRange(/(?:FD.*?24|Fixed.*?24.*?Month)[^0-9]*(\d+\.?\d*)%?\s*[-–]?\s*(\d+\.?\d*)?%/i);
    if (fd24Range) {
        data['FD 24M Nominal Max'] = fd24Range.max;
        data['FD 24M Nominal Min'] = fd24Range.min;
    }
    
    // Mortgage Rate
    const mortgageRange = findRateRange(/(?:Mortgage|Home Loan)[^0-9]*(\d+\.?\d*)%?\s*[-–]?\s*(\d+\.?\d*)?%/i);
    if (mortgageRange) {
        data['Mortgage Rate Min'] = mortgageRange.min;
        data['Mortgage Rate Max'] = mortgageRange.max;
    }
    
    // Credit Card Rate
    const creditCardRange = findRateRange(/(?:Credit Card)[^0-9]*(\d+\.?\d*)%?\s*[-–]?\s*(\d+\.?\d*)?%/i);
    if (creditCardRange) {
        data['Credit Card Rate Min'] = creditCardRange.min;
        data['Credit Card Rate Max'] = creditCardRange.max;
    }
    
    // Personal Loan Rate
    const personalLoanRange = findRateRange(/(?:Personal Loan)[^0-9]*(\d+\.?\d*)%?\s*[-–]?\s*(\d+\.?\d*)?%/i);
    if (personalLoanRange) {
        data['Personal Loan Min'] = personalLoanRange.min;
        data['Personal Loan Max'] = personalLoanRange.max;
    }
    
    // 5. CONTACT INFORMATION
    
    // Phone
    const phoneMatch = text.match(/(?:Tel|Phone|Contact)[:\s]+([+]?\d{3,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4})/i);
    if (phoneMatch) {
        data['Contact Phone'] = phoneMatch[1].trim();
    }
    
    // Website
    const websiteMatch = text.match(/(www\.[a-z0-9.-]+\.co\.bw)/i);
    if (websiteMatch) {
        data['Website'] = 'https://' + websiteMatch[1];
    } else {
        const websiteMatch2 = text.match(/(https?:\/\/[a-z0-9.-]+\.co\.bw)/i);
        if (websiteMatch2) {
            data['Website'] = websiteMatch2[1];
        }
    }
    
    console.log('Extracted data:', JSON.stringify(data, null, 2));
    
    // 6. VALIDATION
    const hasEssentialData = data['Bank Name'] && (
        data['Prime Lending Rate'] || 
        data['FD 12M Nominal Max'] || 
        data['Savings Max'] || 
        data['Call Account Max']
    );
    
    if (!hasEssentialData) {
        console.warn('Insufficient data extracted from PDF');
        return null;
    }
    
    return data;
}

async function updateAirtable(data) {
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const tableName = 'Bank Interest Rates';
    
    console.log('Updating Airtable for:', data['Bank Name']);
    
    // Clean and format data
    const cleanData = { ...data };
    for (const key in cleanData) {
        if (typeof cleanData[key] === 'number') {
            cleanData[key] = parseFloat(cleanData[key].toFixed(2));
        }
    }
    
    // Search for existing record
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}?filterByFormula={Bank Name}="${encodeURIComponent(cleanData['Bank Name'])}"`;
    
    const searchResponse = await fetch(searchUrl, {
        headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`
        }
    });
    
    const searchData = await searchResponse.json();
    
    // Prepare fields
    const fields = {};
    for (const [key, value] of Object.entries(cleanData)) {
        if (value !== null && value !== undefined && value !== '') {
            if (typeof value === 'number' && !isNaN(value)) {
                fields[key] = value;
            } else if (typeof value === 'string' && value.trim()) {
                fields[key] = value.trim();
            }
        }
    }
    
    console.log(`Prepared ${Object.keys(fields).length} fields for Airtable`);
    
    let result;
    
    if (searchData.records && searchData.records.length > 0) {
        // Update existing
        const recordId = searchData.records[0].id;
        const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}/${recordId}`;
        
        const updateResponse = await fetch(updateUrl, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields })
        });
        
        result = await updateResponse.json();
        
        if (!updateResponse.ok) {
            throw new Error(`Airtable update failed: ${JSON.stringify(result)}`);
        }
        
        console.log(`✅ Updated ${cleanData['Bank Name']}`);
        return { action: 'updated', recordId };
    } else {
        // Create new
        const createUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}`;
        
        const createResponse = await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields })
        });
        
        result = await createResponse.json();
        
        if (!createResponse.ok) {
            throw new Error(`Airtable create failed: ${JSON.stringify(result)}`);
        }
        
        console.log(`✅ Created ${cleanData['Bank Name']}`);
        return { action: 'created', recordId: result.id };
    }
}

module.exports = async (req, res) => {
    // Enable CORS
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
            return res.status(400).json({ 
                error: 'Missing filename or content in request body' 
            });
        }
        
        console.log('Processing PDF:', filename);
        
        // Convert and parse PDF
        const pdfBuffer = Buffer.from(content, 'base64');
        const pdfData = await pdf(pdfBuffer);
        const text = pdfData.text;
        
        console.log('PDF size:', text.length, 'characters');
        
        // Extract data
        const extractedData = extractBankRates(text, filename);
        
        if (!extractedData) {
            return res.status(400).json({ 
                error: 'Could not extract bank rates from PDF',
                details: 'No valid bank rates found in the PDF content.',
                suggestions: [
                    '1. Ensure PDF is text-based (not scanned images)',
                    '2. Rename file to include bank name (e.g., "FNB Rates March 2025.pdf")',
                    '3. Verify PDF contains interest rates in percentage format',
                    '4. Use the manual entry form if PDF parsing fails'
                ],
                textSample: text.substring(0, 500)
            });
        }
        
        // Save to Airtable
        const airtableResult = await updateAirtable(extractedData);
        
        res.status(200).json({ 
            success: true, 
            message: 'PDF processed successfully!',
            data: extractedData,
            airtable: airtableResult
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'Failed to process PDF',
            details: error.message
        });
    }
};