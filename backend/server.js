const express = require('express');
const { google } = require('googleapis');
const imap = require('imap');
const cheerio = require('cheerio');
const { simpleParser } = require('mailparser');
require('dotenv').config();
const cors = require('cors');
const { Expo } = require('expo-server-sdk');
let expo = new Expo();

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

        // Send notification after adding the transaction
        const token = process.env.PUSH_TOKEN; // Retrieve the saved token from your database
        sendPushNotification(token, 'New Uncategorized Transaction Added');
        console.log('Uncategorized transaction added and notification sent.');
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

// Endpoint to save Expo push token
app.post('/api/token', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ error: 'Token is required.' });
    }

    // Here you would typically save the token to a database
    // Since it's a practice app, we will just log it
    console.log('Received Expo push token:', token);

    // In a real application, you might also associate the token with a user ID
    // For example, you could store it in a MongoDB collection or similar

    res.status(200).json({ message: 'Token saved successfully.' });
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

// Function to send a push notification
async function sendPushNotification(token, message) {
    if (!Expo.isExpoPushToken(token)) {
        console.error(`Push token ${token} is not a valid Expo push token`);
        return;
    }

    const messages = [{
        to: token,
        sound: 'default',
        body: message,
        data: { withSome: 'data' },
    }];

    try {
        const ticketChunk = await expo.sendPushNotificationsAsync(messages);
        console.log(ticketChunk);
    } catch (error) {
        console.error(error);
    }
}

// Function to get categories from the Google Sheets
async function getCategories() {
    const sheets = google.sheets({ version: 'v4', auth: client });
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
            range: 'Calculations!B128:DS128', // Adjust the range if necessary
        });

        // Flatten the array and remove any empty values
        const categories = response.data.values[0].filter(category => category.trim() !== '');
        return categories;
    } catch (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
}

// Endpoint to get categories
app.get('/categories', async (req, res) => {
    const categories = await getCategories();
    if (categories.length > 0) {
        res.json(categories);
    } else {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Function to get uncategorized transactions from the Google Sheets
async function getUncategorizedTransactions() {
    const sheets = google.sheets({ version: 'v4', auth: client });
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
            range: 'Uncategorized!A:D', // Adjust the range if necessary
        });

        // Map the data to an array of objects
        const transactions = response.data.values.map((row, index) => ({
            id: index + 1,
            date: row[0],
            details: row[1],
            amount: row[2],
            categorized: row[3] === 'true',
        }));

        return transactions;
    } catch (error) {
        console.error('Error fetching uncategorized transactions:', error);
        return [];
    }
}

// Endpoint to get uncategorized transactions
app.get('/uncategorized-transactions', async (req, res) => {
    const transactions = await getUncategorizedTransactions();
    if (transactions.length > 0) {
        res.json(transactions);
    } else {
        res.status(500).json({ error: 'Failed to fetch uncategorized transactions' });
    }
});

async function getSheetId(sheetName) {
    const sheets = google.sheets({ version: 'v4', auth: client });

    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
        });

        const sheet = response.data.sheets.find(sheet => sheet.properties.title === sheetName);
        return sheet ? sheet.properties.sheetId : null;
    } catch (error) {
        console.error(`Error getting sheet ID for "${sheetName}":`, error);
        return null;
    }
}

// Function to delete an uncategorized transaction by row number
async function deleteUncategorizedTransaction(rowIndex) {
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Get the sheetId for the 'Uncategorized' sheet
    const sheetId = await getSheetId('Uncategorized');
    if (!sheetId) {
        console.error('Failed to retrieve the sheet ID.');
        return;
    }

    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
            resource: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: rowIndex - 1, // Assuming rowIndex starts from 1
                                endIndex: rowIndex,
                            },
                        },
                    },
                ],
            },
        });
        console.log(`Row ${rowIndex} deleted successfully.`);
    } catch (error) {
        console.error('Error deleting uncategorized transaction:', error);
        throw error; // Rethrow error to handle it in the calling function
    }
}

app.delete('/uncategorized-transactions/:rowIndex', async (req, res) => {
    const { rowIndex } = req.params;

    try {
        await deleteUncategorizedTransaction(parseInt(rowIndex));
        res.status(200).json({ message: 'Transaction deleted successfully.' });
    } catch (error) {
        console.error('Error deleting uncategorized transaction:', error);
        res.status(500).json({ error: 'Failed to delete transaction.' });
    }
});

// Start the server and initiate email checking immediately
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    processEmails(); // Check emails immediately upon server start
    setInterval(processEmails, 1 * 60 * 1000); // Check emails every 1 minutes
});