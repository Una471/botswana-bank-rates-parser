// This is a serverless function for PDF parsing
// Deploy on Vercel, Netlify, or AWS Lambda

const pdf = require('pdf-parse');
const Airtable = require('airtable');

// Configure Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
    .base(process.env.AIRTABLE_BASE_ID);

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { filename, content } = req.body;
        
        // Convert base64 to buffer
        const pdfBuffer = Buffer.from(content, 'base64');
        
        // Parse PDF
        const pdfData = await pdf(pdfBuffer);
        const text = pdfData.text;
        
        // Extract bank rates using regex patterns
        const extractedData = extractBankRates(text);
        
        if (!extractedData) {
            return res.status(400).json({ error: 'Could not extract bank rates from PDF' });
        }
        
        // Update or create record in Airtable
        await updateAirtable(extractedData, filename);
        
        res.status(200).json({ 
            success: true, 
            message: 'PDF processed and data updated',
            data: extractedData 
        });
        
    } catch (error) {
        console.error('PDF processing error:', error);
        res.status(500).json({ error: 'Failed to process PDF' });
    }
};

function extractBankRates(text) {
    // This function extracts rates from PDF text
    // Customize based on your PDF format
    
    const data = {
        'Bank Name': null,
        'Report Period': null,
        'MoPR': null,
        'Prime Lending Rate': null,
        'Savings Min': null,
        'Savings Max': null,
        'FD 12M Nominal Min': null,
        'FD 12M Nominal Max': null,
        'Credit Card Rate Min': null,
        'Credit Card Rate Max': null,
        'Auto Updated': true,
        'Update Date': new Date().toISOString().split('T')[0],
        'Data Source': 'PDF Upload'
    };
    
    // Extract bank name
    const bankNameMatch = text.match(/(?:FNB|Stanbic|Access Bank|First National Bank)\s*(?:Botswana)?/i);
    if (bankNameMatch) {
        data['Bank Name'] = bankNameMatch[0].trim();
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
    
    // Extract Savings rates
    const savingsMatch = text.match(/Savings.*?(\d+\.?\d*)%?\s*-\s*(\d+\.?\d*)%?/i);
    if (savingsMatch) {
        data['Savings Min'] = parseFloat(savingsMatch[1]);
        data['Savings Max'] = parseFloat(savingsMatch[2]);
    }
    
    // Extract 12M Fixed Deposit rates
    const fd12Match = text.match(/12\s*(?:Month|M).*?(\d+\.?\d*)%?\s*-\s*(\d+\.?\d*)%?/i);
    if (fd12Match) {
        data['FD 12M Nominal Min'] = parseFloat(fd12Match[1]);
        data['FD 12M Nominal Max'] = parseFloat(fd12Match[2]);
    }
    
    // Extract Credit Card rates
    const ccMatch = text.match(/Credit Card.*?(\d+\.?\d*)%?\s*-\s*(\d+\.?\d*)%?/i);
    if (ccMatch) {
        data['Credit Card Rate Min'] = parseFloat(ccMatch[1]);
        data['Credit Card Rate Max'] = parseFloat(ccMatch[2]);
    }
    
    // Extract report period
    const periodMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+202\d/i);
    if (periodMatch) {
        data['Report Period'] = periodMatch[0];
    }
    
    // Only return data if we found a bank name
    return data['Bank Name'] ? data : null;
}

async function updateAirtable(data, filename) {
    const tableName = 'Bank Interest Rates';
    
    try {
        // Search for existing record
        const records = await base(tableName)
            .select({
                filterByFormula: `{Bank Name} = "${data['Bank Name']}"`
            })
            .firstPage();
        
        // Prepare fields (remove null values)
        const fields = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== null)
        );
        
        if (records.length > 0) {
            // Update existing record
            await base(tableName).update(records[0].id, fields);
            console.log(`Updated record for ${data['Bank Name']}`);
        } else {
            // Create new record
            await base(tableName).create(fields);
            console.log(`Created new record for ${data['Bank Name']}`);
        }
    } catch (error) {
        console.error('Airtable update error:', error);
        throw error;
    }
}