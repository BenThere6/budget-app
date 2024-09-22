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

console.log(process.env.PUSH_TOKEN);

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

const formatDollarAmount = (amount) => {
    return `$${Math.round(amount)}`;
};

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
            if (a.amount && !b.amount) return -1;
            if (!a.amount && b.amount) return 1;
            return b.keyword.length - a.keyword.length;
        });

        let newUncategorizedCount = 0;

        for (const transaction of transactions) {
            let matched = false;

            const lowerCaseDetails = transaction.details.toLowerCase();

            if (lowerCaseDetails.includes('maverik') || lowerCaseDetails.includes('chevron')) {
                const transactionAmount = parseFloat(transaction.amount);
                let category = transactionAmount < 15 ? 'food' : 'gas';

                await addTransaction(transaction.date, transaction.details, transaction.amount, category);
                await notifyCategoryTransaction(category, transaction.amount);
                matched = true;
                continue;
            }

            for (const { keyword, category, amount } of keywords) {
                const keywordMatches = lowerCaseDetails.includes(keyword.toLowerCase());
                const amountMatches = amount === null || transaction.amount === amount;

                if (keywordMatches && amountMatches) {
                    await addTransaction(transaction.date, transaction.details, transaction.amount, category);
                    await notifyCategoryTransaction(category, transaction.amount);
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                await addUncategorizedTransaction(transaction.date, transaction.details, transaction.amount);
                newUncategorizedCount++;
            }
        }

        if (newUncategorizedCount > 0) {
            const token = process.env.PUSH_TOKEN;
            sendPushNotification(token, `${newUncategorizedCount} new uncategorized transaction(s) added.`);
        }

    } catch (err) {
        console.error('Error during automatic email check:', err);
    }
}

// Helper function to clean and convert strings to float
function cleanAndParseFloat(value) {
    const cleanedValue = value.replace(/[$,]/g, '').trim();
    return parseFloat(cleanedValue);
}

// Function to fetch budget data and keep the original logic intact
async function getBudgetData() {
    const sheets = google.sheets({ version: 'v4', auth: client });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); 

    const baseYear = 2024;
    const baseRow = 3; 

    let rowToFetch = baseRow + (currentYear - baseYear) * 12 + currentMonth;

    const rangeGoals = `Minutia!A${rowToFetch}:F${rowToFetch}`;  
    const rangeSums = `Minutia!H${rowToFetch}:N${rowToFetch}`;  
    const rangeFillupPrice = 'Calculations!B13';

    try {
        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
            ranges: [rangeGoals, rangeSums, rangeFillupPrice],
        });

        const goalsData = response.data.valueRanges[0].values[0];  
        const sumsData = response.data.valueRanges[1].values[0];   
        let fillupPriceRaw = response.data.valueRanges[2].values[0][0];

        fillupPriceRaw = fillupPriceRaw.replace(/[$\s]/g, '');  
        const fillupPrice = parseFloat(fillupPriceRaw); 

        if (isNaN(fillupPrice)) {
            console.error("Invalid fill-up price:", fillupPriceRaw);
            return null;
        }

        const percentMonthPassed = getPercentMonthPassed(sumsData[0]);
        const foodBudget = cleanAndParseFloat(goalsData[2]);
        const shoppingBudget = cleanAndParseFloat(goalsData[3]);
        const gasBudget = cleanAndParseFloat(goalsData[4]);
        const otherBudget = cleanAndParseFloat(goalsData[5]);

        const foodUsed = cleanAndParseFloat(sumsData[3]);
        const shoppingUsed = cleanAndParseFloat(sumsData[4]);
        const gasUsed = cleanAndParseFloat(sumsData[5]);
        const otherUsed = cleanAndParseFloat(sumsData[6]);

        return {
            percentMonthPassed,
            food: {
                total: foodBudget,
                used: foodUsed,
                remaining: foodBudget - foodUsed
            },
            shopping: {
                total: shoppingBudget,
                used: shoppingUsed,
                remaining: shoppingBudget - shoppingUsed
            },
            gas: {
                total: gasBudget,
                used: gasUsed,
                remaining: gasBudget - gasUsed
            },
            other: {
                total: otherBudget,
                used: otherUsed,
                remaining: otherBudget - otherUsed
            },
            fillupPrice,
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

// Function to get uncategorized transactions
async function getUncategorizedTransactions() {
    const sheets = google.sheets({ version: 'v4', auth: client });
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
            range: 'Uncategorized!A:D',
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('No uncategorized transactions found.');
            return [];
        }

        const headers = rows[0];
        const isHeader = headers[0]?.toLowerCase() === "date" && headers[1]?.toLowerCase() === "details";

        const dataRows = isHeader ? rows.slice(1) : rows;

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

// New notification logic for categorized transactions
async function notifyCategoryTransaction(category, amount) {
    const token = process.env.PUSH_TOKEN; 
    const budgetData = await getBudgetData();
    if (!budgetData) {
        console.error('Failed to retrieve budget data.');
        return;
    }

    let message = '';

    switch (category.toLowerCase()) {
        case 'food':
        case 'shopping':
        case 'gas':
        case 'minutia other':
            const remaining = budgetData[category].remaining.toFixed(2);
            message = `You spent $${amount} on ${category}. You have $${remaining} left in your ${category} budget.`;
            break;
        default:
            message = `A ${category} transaction of $${amount} has been applied.`;
    }

    if (Expo.isExpoPushToken(token)) {
        await sendPushNotification(token, message);
    }
}

async function sendPushNotification(token, message, data = {}) {
    const messages = [{
        to: token,
        sound: 'default',
        body: message,
        data: data,
    }];

    try {
        const ticketChunk = await expo.sendPushNotificationsAsync(messages);
        console.log(ticketChunk);
    } catch (error) {
        console.error(error);
    }
}

// Function to send low-budget alert
async function sendLowBudgetAlert(category, remainingAmount) {
    const token = process.env.PUSH_TOKEN;
    if (remainingAmount < 10) {
        const message = `Warning: Your ${category} budget is running low. Only $${remainingAmount} left.`;
        await sendPushNotification(token, message);
    }
}

// All routes remain unchanged from original logic

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
    console.log(budgetData);
    if (budgetData) {
        res.json(budgetData);
    } else {
        res.status(500).json({ error: 'Failed to fetch budget data' });
    }
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

// Endpoint to get uncategorized transactions
app.get('/uncategorized-transactions', async (req, res) => {
    const transactions = await getUncategorizedTransactions();
    if (transactions.length > 0) {
        res.json(transactions);
    } else {
        res.status(500).json({ error: 'Failed to fetch uncategorized transactions' });
    }
});

// Start the server and initiate email checking immediately
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    if (shouldCheckEmails) {
        processEmails(); 
        setInterval(processEmails, 1 * 60 * 1000); 
    }
});