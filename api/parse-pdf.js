// api/parse-pdf.js
const pdf = require('pdf-parse');

async function extractBankRates(text, filename) {
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
    
    // Your extraction logic here (same as before)
    // ... [Keep your existing extraction logic]
    
    return data['Bank Name'] ? data : null;
}

async function updateAirtable(data) {
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const tableName = 'Bank Interest Rates';
    
    // ... [Keep your existing Airtable update logic]
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