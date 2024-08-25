const express = require('express');
const { google } = require('googleapis');
const imap = require('imap');
const cheerio = require('cheerio');
const { simpleParser } = require('mailparser');
require('dotenv').config();
const cors = require('cors');
 
// Initialize Express app
const app = express();
const port = process.env.PORT || 3009;

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cors());

// Use environment variable for Google service account key
let serviceAccountKey;

if (process.env.NODE_ENV === 'production') {
    serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
} else {
    // In development, load the key from a local file
    serviceAccountKey = require('./service-account-key.json');
}

// Set up the JWT client using the service account key
const client = new google.auth.JWT(
    serviceAccountKey.client_email,
    null,
    serviceAccountKey.private_key.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets'] // This scope gives full access to the Google Sheets API
);

// Gmail IMAP configuration
const imapConfig = {
    user: 'transactions1256@gmail.com',
    password: process.env.EMAIL_PASSWORD,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
};

// Function to get all keywords from the Keywords tab
async function getKeywords() {
    const sheets = google.sheets({ version: 'v4', auth: client });
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
            range: 'Keywords!A:B',
        });
        return response.data.values; // Returns an array of [keyword, category]
    } catch (error) {
        console.error('Error fetching keywords:', error);
        return [];
    }
}

// Function to add a categorized transaction
async function addTransaction(date, details, amount, category) {
    const sheets = google.sheets({ version: 'v4', auth: client });
    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
            range: 'Transactions!A:D',
            valueInputOption: 'RAW',
            resource: {
                values: [[date, category, amount, details]],
            },
        });
    } catch (error) {
        console.error('Error adding categorized transaction:', error);
    }
}

// Function to add an uncategorized transaction
async function addUncategorizedTransaction(date, details, amount) {
    const sheets = google.sheets({ version: 'v4', auth: client });
    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
            range: 'Uncategorized!A:D',
            valueInputOption: 'RAW',
            resource: {
                values: [[date, details, amount, 'false']],
            },
        });
    } catch (error) {
        console.error('Error adding uncategorized transaction:', error);
    }
}

// Function to check emails
async function checkEmails() {
    return new Promise((resolve, reject) => {
        const mail = new imap(imapConfig);

        mail.once('ready', () => {
            mail.openBox('INBOX', false, () => {
                mail.search([['FROM', 'noreply@alert.macu.com'], ['SUBJECT', 'Transaction Alert from Mountain America Credit Union']], (err, results) => {
                    if (err) {
                        return reject(err);
                    }

                    if (!results || !results.length) {
                        return resolve([]);
                    }

                    const transactions = [];
                    const parsePromises = [];

                    const fetch = mail.fetch(results, { bodies: '', markSeen: true });
                    fetch.on('message', msg => {
                        parsePromises.push(
                            new Promise((resolve, reject) => {
                                msg.on('body', stream => {
                                    simpleParser(stream, async (err, parsed) => {
                                        if (err) {
                                            return reject(err);
                                        }

                                        const html = parsed.html;
                                        if (html) {
                                            const transactionDetails = parseTransactionDetails(html);
                                            transactions.push(...transactionDetails);
                                        }
                                        resolve();
                                    });
                                });
                            })
                        );

                        // Mark message for deletion after processing
                        msg.once('attributes', attrs => {
                            const { uid } = attrs;
                            mail.addFlags(uid, '\\Deleted', err => {
                                if (err) {
                                    console.error('Error marking email for deletion:', err);
                                }
                            });
                        });
                    });

                    fetch.once('end', async () => {
                        await Promise.all(parsePromises);
                        mail.expunge();
                        mail.end();
                        resolve(transactions);
                    });
                });
            });
        });

        mail.once('error', err => {
            console.error('Error with IMAP connection:', err);
            reject(err);
        });

        mail.connect();
    });
}

// Function to parse transaction details from the email HTML content
function parseTransactionDetails(html) {
    const $ = cheerio.load(html);
    const transactions = [];

    $('table.transactions tbody tr.transaction-row').each((index, element) => {
        const dateRaw = $(element).find('td.date').text().trim().replace(/\s+/g, ' ');

        const [month, day, year] = dateRaw.match(/\b[A-Z][a-z]+|\d{2,4}/g);
        const monthNumber = new Date(`${month} 1`).getMonth() + 1;
        const formattedDate = `${monthNumber}/${day}/${year.slice(-2)}`;

        const details = $(element).find('td.details').text().trim();
        let amount = $(element).find('td.amount').text().trim();

        amount = parseFloat(amount.replace(/[()$]/g, '')).toFixed(2);

        transactions.push({ date: formattedDate, details, amount });
    });

    return transactions;
}

// Function to handle the email checking process
async function processEmails() {
    try {
        console.log('Checking for new emails...');
        const transactions = await checkEmails();
        const keywords = await getKeywords();

        for (const transaction of transactions) {
            let matched = false;
            for (const [keyword, category] of keywords) {
                if (transaction.details.includes(keyword)) {
                    await addTransaction(transaction.date, transaction.details, transaction.amount, category);
                    console.log(`Categorized transaction found and added: ${transaction.details}`);
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                await addUncategorizedTransaction(transaction.date, transaction.details, transaction.amount);
                console.log(`Uncategorized transaction found and added: ${transaction.details}`);
            }
        }

    } catch (err) {
        console.error('Error during automatic email check:', err);
    }
}

// Function to get budget data
async function getBudgetData() {
    const sheets = google.sheets({ version: 'v4', auth: client });
    try {
        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
            ranges: ['Dashboard!C19', 'Dashboard!E19', 'Dashboard!G19', 'Dashboard!C23'],
        });
        return {
            food: response.data.valueRanges[0].values[0][0],
            shopping: response.data.valueRanges[1].values[0][0],
            gas: response.data.valueRanges[2].values[0][0],
            other: response.data.valueRanges[3].values[0][0],
        };
    } catch (error) {
        console.error('Error fetching budget data:', error);
        return null;
    }
}

// Endpoint to get budget data
app.get('/budget', async (req, res) => {
    const budgetData = await getBudgetData();
    if (budgetData) {
        res.json(budgetData);
    } else {
        res.status(500).json({ error: 'Failed to fetch budget data' });
    }
});

// Function to get savings data
async function getSavingsData() {
    const sheets = google.sheets({ version: 'v4', auth: client });
    try {
        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
            ranges: [
                'Dashboard!C31', 'Dashboard!E31', 'Dashboard!G31',
                'Dashboard!C34', 'Dashboard!E34', 'Dashboard!G34',
                'Dashboard!C37'
            ],
        });
        return {
            emergency: response.data.valueRanges[0].values[0][0],
            general: response.data.valueRanges[1].values[0][0],
            future: response.data.valueRanges[2].values[0][0],
            treatYoSelf: response.data.valueRanges[3].values[0][0],
            vehicle: response.data.valueRanges[4].values[0][0],
            giftsDonations: response.data.valueRanges[5].values[0][0],
            travelVacation: response.data.valueRanges[6].values[0][0],
        };
    } catch (error) {
        console.error('Error fetching savings data:', error);
        return null;
    }
}

// Endpoint to get savings data
app.get('/savings', async (req, res) => {
    const savingsData = await getSavingsData();
    if (savingsData) {
        res.json(savingsData);
    } else {
        res.status(500).json({ error: 'Failed to fetch savings data' });
    }
});

// Endpoint to save a keyword and category
app.post('/save-keyword', async (req, res) => {
    const { keyword, category } = req.body;
  
    if (!keyword || !category) {
      return res.status(400).json({ error: 'Keyword and category are required.' });
    }
  
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
        range: 'Keywords!A:B',
        valueInputOption: 'RAW',
        resource: {
          values: [[keyword, category]],
        },
      });
      res.status(200).json({ message: 'Keyword and category saved successfully.' });
    } catch (error) {
      console.error('Error saving keyword and category:', error);
      res.status(500).json({ error: 'Failed to save keyword and category.' });
    }
});  

// Start the server and initiate email checking immediately
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    processEmails(); // Check emails immediately upon server start
    setInterval(processEmails, 5 * 60 * 1000); // Check emails every 5 minutes
});