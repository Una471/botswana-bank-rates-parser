const pdf = require('pdf-parse');

module.exports = async (req, res) => {
    // Enable CORS (allows admin.html to talk to this API)
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
        
        // Convert PDF from base64 to readable format
        const pdfBuffer = Buffer.from(content, 'base64');
        
        // Extract text from PDF
        const pdfData = await pdf(pdfBuffer);
        const text = pdfData.text;
        
        console.log('PDF Text extracted:', text.substring(0, 500));
        
        // Extract bank rates from the text
        const extractedData = extractBankRates(text, filename);
        
        if (!extractedData || !extractedData['Bank Name']) {
            return res.status(400).json({ 
                error: 'Could not extract bank rates from PDF. Please check PDF format.',
                sample: text.substring(0, 500)
            });
        }
        
        // Save to Airtable
        await updateAirtable(extractedData);
        
        res.status(200).json({ 
            success: true, 
            message: 'PDF processed successfully!',
            data: extractedData 
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'Failed to process PDF',
            details: error.message 
        });
    }
};

// Function to extract rates from PDF text
function extractBankRates(text, filename) {
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
    
    // Detect bank from filename first
    if (filename.toLowerCase().includes('fnb')) {
        data['Bank Name'] = 'FNB Botswana';
    } else if (filename.toLowerCase().includes('stanbic')) {
        data['Bank Name'] = 'Stanbic Bank Botswana';
    } else if (filename.toLowerCase().includes('access')) {
        data['Bank Name'] = 'Access Bank Botswana';
    } else {
        // Try to find bank name in PDF text
        const bankMatch = text.match(/(?:FNB|First National Bank|Stanbic|Access Bank)\s*(?:Botswana)?/i);
        if (bankMatch) {
            const name = bankMatch[0].toLowerCase();
            if (name.includes('fnb') || name.includes('first national')) {
                data['Bank Name'] = 'FNB Botswana';
            } else if (name.includes('stanbic')) {
                data['Bank Name'] = 'Stanbic Bank Botswana';
            } else if (name.includes('access')) {
                data['Bank Name'] = 'Access Bank Botswana';
            }
        }
    }
    
    // Extract Report Period (e.g., "January 2026")
    const periodMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+202\d/i);
    if (periodMatch) {
        data['Report Period'] = periodMatch[0];
    }
    
    // Extract MoPR
    const moprMatch = text.match(/(?:MoPR|Monetary Policy Rate)[:\s]+(\d+\.?\d*)/i);
    if (moprMatch) {
        data['MoPR'] = parseFloat(moprMatch[1]);
    }
    
    // Extract Prime Rate
    const primeMatch = text.match(/(?:Prime Lending Rate|Prime Rate)[:\s]+(\d+\.?\d*)/i);
    if (primeMatch) {
        data['Prime Lending Rate'] = parseFloat(primeMatch[1]);
    }
    
    // Extract Savings rates (looks for pattern like "0.00% - 2.50%")
    const savingsMatch = text.match(/Savings.*?(\d+\.?\d*)%?\s*[-–]\s*(\d+\.?\d*)%?/i);
    if (savingsMatch) {
        data['Savings Min'] = parseFloat(savingsMatch[1]);
        data['Savings Max'] = parseFloat(savingsMatch[2]);
    }
    
    // Extract Call Account rates
    const callMatch = text.match(/Call.*?(\d+\.?\d*)%?\s*[-–]\s*(\d+\.?\d*)%?/i);
    if (callMatch) {
        data['Call Account Min'] = parseFloat(callMatch[1]);
        data['Call Account Max'] = parseFloat(callMatch[2]);
    }
    
    // Extract 12 Month Fixed Deposit rates
    const fd12Match = text.match(/12\s*(?:Month|M).*?(\d+\.?\d*)%?\s*[-–]\s*(\d+\.?\d*)%?/i);
    if (fd12Match) {
        data['FD 12M Nominal Min'] = parseFloat(fd12Match[1]);
        data['FD 12M Nominal Max'] = parseFloat(fd12Match[2]);
    }
    
    // Extract Credit Card rates
    const ccMatch = text.match(/Credit Card.*?(\d+)%?\s*[-–]\s*(\d+)%?/i);
    if (ccMatch) {
        data['Credit Card Rate Min'] = parseFloat(ccMatch[1]);
        data['Credit Card Rate Max'] = parseFloat(ccMatch[2]);
    }
    
    // Extract phone number
    const phoneMatch = text.match(/(?:Tel|Phone|Contact)[:\s]+(\d{3,4}\s*\d{3,4})/i);
    if (phoneMatch) {
        data['Contact Phone'] = phoneMatch[1];
    }
    
    // Extract website
    const websiteMatch = text.match(/(www\.[a-z0-9]+\.co\.bw|https?:\/\/[^\s]+\.co\.bw)/i);
    if (websiteMatch) {
        data['Website'] = websiteMatch[1].startsWith('http') ? websiteMatch[1] : 'https://' + websiteMatch[1];
    }
    
    return data['Bank Name'] ? data : null;
}

// Function to update Airtable
async function updateAirtable(data) {
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const tableName = 'Bank Interest Rates';
    
    // Search for existing bank record
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}?filterByFormula={Bank Name}="${data['Bank Name']}"`;
    
    const searchResponse = await fetch(searchUrl, {
        headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`
        }
    });
    
    const searchData = await searchResponse.json();
    
    // Remove null values
    const fields = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== null)
    );
    
    if (searchData.records && searchData.records.length > 0) {
        // Update existing bank record
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
        
        console.log(`✅ Updated ${data['Bank Name']}`);
    } else {
        // Create new bank record
        const createUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}`;
        
        await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields })
        });
        
        console.log(`✅ Created ${data['Bank Name']}`);
    }
}