const express = require('express');
const { google } = require('googleapis');
const imap = require('imap');
const cheerio = require('cheerio');
const { simpleParser } = require('mailparser');
require('dotenv').config();
const cors = require('cors');
const { Expo } = require('expo-server-sdk');
let expo = new Expo();

const shouldCheckEmails = true;

// Initialize Express app
const app = express();
const port = process.env.PORT || 3009;

console.log(process.env.PUSH_TOKEN)

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

// All Functions

// Function to get all keywords from the Keywords tab
async function getKeywords() {
    const sheets = google.sheets({ version: 'v4', auth: client });
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
            range: 'Keywords!A:C',  // Adjust the range to include the third column for amount
        });
        return response.data.values.map(([keyword, category, amount]) => ({
            keyword,
            category,
            amount: amount ? parseFloat(amount) : null, // Convert amount to number or null if not provided
        })); // Returns an array of { keyword, category, amount }
    } catch (error) {
        console.error('Error fetching keywords:', error);
        return [];
    }
}

// Function to add a categorized transaction
async function addTransaction(date, details, amount, category) {
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Format the date as MM-DD-YYYY
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const numericAmount = parseFloat(amount); // Convert amount to a number

    try {
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
            range: 'Transactions!A:D',
            valueInputOption: 'USER_ENTERED', // Use USER_ENTERED to prevent the tick mark
            resource: {
                values: [[formattedDate, category, numericAmount, details]],
            },
        });

        if (response.status === 200) {
            console.log('Transaction added to Transactions tab successfully.');
        } else {
            console.error(`Failed to add transaction. Status: ${response.status}, Message: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error adding categorized transaction:', error);
    }
}

// Function to add an uncategorized transaction
async function addUncategorizedTransaction(date, details, amount) {
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Format the date as MM-DD-YYYY
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const numericAmount = parseFloat(amount); // Convert amount to a number

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
            range: 'Uncategorized!A:D',
            valueInputOption: 'USER_ENTERED', // Use USER_ENTERED to prevent the tick mark
            resource: {
                values: [[formattedDate, details, numericAmount, 'false']],
            },
        });

        console.log('Uncategorized transaction added.');
    } catch (error) {
        console.error('Error adding uncategorized transaction:', error);
    }
}

// Function to check emails with retry logic
async function checkEmails(retries = 3) {
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

        mail.once('error', async err => {
            console.error('Error with IMAP connection:', err);
            if (retries > 0) {
                console.log(`Retrying IMAP connection... (${retries} retries left)`);
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds before retrying
                resolve(await checkEmails(retries - 1)); // Retry the connection
            } else {
                reject(err); // If all retries fail, reject the promise
            }
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

// Function to process emails and categorize transactions
async function processEmails() {
    try {
        console.log('Checking for new emails...');
        const transactions = await checkEmails();
        let keywords = await getKeywords();

        // Sort keywords by specificity (amount presence and then by keyword length)
        keywords.sort((a, b) => {
            // Prioritize keywords with amounts first, then by keyword length
            if (a.amount && !b.amount) return -1;
            if (!a.amount && b.amount) return 1;
            return b.keyword.length - a.keyword.length;
        });

        let newUncategorizedCount = 0;

        for (const transaction of transactions) {
            let matched = false;
            for (const { keyword, category, amount } of keywords) {
                const keywordMatches = transaction.details.includes(keyword);
                const amountMatches = amount === null || transaction.amount === amount;

                // Check if both keyword and amount match
                if (keywordMatches && amountMatches) {
                    await addTransaction(transaction.date, transaction.details, transaction.amount, category);
                    console.log(`Categorized transaction found and added: ${transaction.details} with category ${category}`);
                    matched = true;
                    break;
                }
            }
            // If no match is found, add the transaction to the uncategorized list
            if (!matched) {
                await addUncategorizedTransaction(transaction.date, transaction.details, transaction.amount);
                console.log(`Uncategorized transaction found and added: ${transaction.details}`);
                newUncategorizedCount++; // Increase the count for each new uncategorized transaction
            }
        }

        if (newUncategorizedCount > 0) {
            const token = process.env.PUSH_TOKEN; // Retrieve the saved token from your database
            sendPushNotification(token, `${newUncategorizedCount} new uncategorized transaction(s) added.`);
            console.log('Summary notification sent for new uncategorized transactions.');
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

// Function to get uncategorized transactions from the Google Sheets
async function getUncategorizedTransactions() {
    const sheets = google.sheets({ version: 'v4', auth: client });
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
            range: 'Uncategorized!A:D', // Adjust the range if necessary
        });

        // Check if the response contains any values
        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('No uncategorized transactions found.');
            return []; // Return an empty array if there are no uncategorized transactions
        }

        // Check if the first row looks like headers
        const headers = rows[0];
        const isHeader = headers[0]?.toLowerCase() === "date" && headers[1]?.toLowerCase() === "details";

        // Skip the first row if it's a header
        const dataRows = isHeader ? rows.slice(1) : rows;

        // Map the data to an array of objects
        const transactions = dataRows.map((row, index) => ({
            id: index + 1,
            date: row[0] || '',
            details: row[1] || '',
            amount: row[2] || '',
            categorized: row[3] === 'true',
        }));

        return transactions;
    } catch (error) {
        console.error('Error fetching uncategorized transactions:', error);
        return [];
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
                                startIndex: rowIndex - 1, // Adjusted to match Google Sheets API 0-based indexing
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

// All Routes

// Endpoint to get current keywords
app.get('/keywords', async (req, res) => {
    try {
        const keywords = await getKeywords(); // Use the existing getKeywords function
        res.status(200).json(keywords);
    } catch (error) {
        console.error('Error fetching keywords:', error);
        res.status(500).json({ error: 'Failed to fetch keywords.' });
    }
});

// Endpoint to add a transaction
app.post('/add-transaction', async (req, res) => {
    const { date, category, amount, details } = req.body;

    if (!date || !category || !amount || !details) {
        return res.status(400).json({ error: 'Date, category, amount, and details are required.' });
    }

    try {
        await addTransaction(date, details, amount, category);
        res.status(200).json({ message: 'Transaction added successfully.' });
    } catch (error) {
        console.error('Error adding transaction:', error);
        res.status(500).json({ error: 'Failed to add transaction.' });
    }
});

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

    res.status(200).json({ message: 'Token saved successfully.' });
});

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
    const { keyword, category, amount } = req.body;

    if (!keyword || !category) {
        return res.status(400).json({ error: 'Keyword and category are required.' });
    }

    const sheets = google.sheets({ version: 'v4', auth: client });

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
            range: 'Keywords!A:C', // Adjusted range to include amount
            valueInputOption: 'RAW',
            resource: {
                values: [[keyword, category, amount || '']], // Save amount if provided
            },
        });
        res.status(200).json({ message: 'Keyword, category, and amount saved successfully.' });
    } catch (error) {
        console.error('Error saving keyword, category, and amount:', error);
        res.status(500).json({ error: 'Failed to save keyword, category, and amount.' });
    }
});

app.delete('/delete-keyword', async (req, res) => {
    const { keyword } = req.body;

    try {
        // Fetch all keywords from the Google Sheets
        const keywords = await getKeywords();

        // Find the index of the keyword in the sheet
        const keywordIndex = keywords.findIndex(k => k.keyword === keyword);

        if (keywordIndex === -1) {
            return res.status(404).send('Keyword not found.');
        }

        // Get the sheet ID of the "Keywords" tab
        const sheetId = await getSheetId('Keywords');
        if (!sheetId) {
            return res.status(500).send('Failed to retrieve the sheet ID.');
        }

        // Delete the row corresponding to the keyword in the sheet
        await google.sheets({ version: 'v4', auth: client }).spreadsheets.batchUpdate({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
            resource: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: keywordIndex + 0,
                                endIndex: keywordIndex + 1,
                            },
                        },
                    },
                ],
            },
        });

        res.status(200).send('Keyword deleted successfully.');
    } catch (error) {
        console.error('Error deleting keyword:', error);
        res.status(500).send('Failed to delete keyword.');
    }
});

// Endpoint to get categories
app.get('/categories', async (req, res) => {
    const categories = await getCategories();
    if (categories.length > 0) {
        res.json(categories);
    } else {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Endpoint to categorize an uncategorized transaction
app.post('/categorize-transaction', async (req, res) => {
    const { id, category } = req.body;

    if (!id || !category) {
        return res.status(400).json({ error: 'Transaction ID and category are required.' });
    }

    try {
        // Fetch the uncategorized transaction by its ID
        const transactions = await getUncategorizedTransactions();
        const transactionToCategorize = transactions.find(t => t.id === id);

        if (!transactionToCategorize) {
            return res.status(404).json({ error: 'Transaction not found.' });
        }

        // Move the transaction to the categorized 'Transactions' tab
        await addTransaction(transactionToCategorize.date, transactionToCategorize.details, transactionToCategorize.amount, category);

        // Delete the transaction from the 'Uncategorized' tab
        await deleteUncategorizedTransaction(transactionToCategorize.id);

        return res.status(200).json({ message: 'Transaction moved to Transactions tab and deleted from Uncategorized.' });
    } catch (error) {
        console.error('Error categorizing transaction:', error);
        return res.status(500).json({ error: 'Failed to categorize transaction.' });
    }
});

// Endpoint to get uncategorized transactions
app.get('/uncategorized-transactions', async (req, res) => {
    const transactions = await getUncategorizedTransactions();
    if (transactions.length > 0) {
        res.json(transactions);
    } else {
        res.status(500).json({ error: 'Failed to fetch uncategorized transactions' });
    }
});

// Endpoint to delete uncategorized transactions
app.delete('/uncategorized-transactions/:rowIndex', async (req, res) => {
    const { rowIndex } = req.params;

    try {
        const rowIndexInt = parseInt(rowIndex);

        // Fetch the uncategorized transaction to be deleted
        const transactions = await getUncategorizedTransactions();
        const transactionToDelete = transactions.find(t => t.id === rowIndexInt);

        if (!transactionToDelete) {
            console.error(`Transaction with ID ${rowIndex} not found.`);
            return res.status(404).json({ error: 'Transaction not found.' });
        }

        // Re-fetch all keywords and their categories to ensure the list is up-to-date
        const keywords = await getKeywords();

        // Check if the transaction's details contain any of the saved keywords
        let matchingKeyword = null;
        for (const { keyword, category, amount } of keywords) {
            if (transactionToDelete.details.includes(keyword)) {
                matchingKeyword = { keyword, category, amount };
                break;
            }
        }

        if (!matchingKeyword) {
            console.error(`Cannot delete transaction with ID ${rowIndex}. No matching keywords found.`);
            return res.status(403).json({ error: 'Cannot delete transaction. No matching keywords found.' });
        }

        // Add the transaction to the categorized tab first
        await addTransaction(transactionToDelete.date, transactionToDelete.details, transactionToDelete.amount, matchingKeyword.category);

        // Then delete the transaction from the uncategorized tab
        await deleteUncategorizedTransaction(rowIndexInt);

        res.status(200).json({ message: 'Transaction moved to categorized and deleted from uncategorized.' });
    } catch (error) {
        console.error(`Error deleting uncategorized transaction with ID ${rowIndex}:`, error);
        res.status(500).json({ error: 'Failed to delete transaction.' });
    }
});

// Start the server and initiate email checking immediately
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    if (shouldCheckEmails) {
        processEmails(); // Check emails immediately upon server start
        setInterval(processEmails, 1 * 60 * 1000); // Check emails every 1 minutes
    }
});