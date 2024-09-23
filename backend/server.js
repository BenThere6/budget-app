const express = require('express');
const { google } = require('googleapis');
const imap = require('imap');
const cheerio = require('cheerio');
const { simpleParser } = require('mailparser');
require('dotenv').config();
const cors = require('cors');
const { Expo } = require('expo-server-sdk');
const schedule = require('node-schedule'); // For scheduling tasks
const { automateDonation } = require('./tithing'); // Import the automateDonation function

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
            // Prioritize keywords with amounts first, then by keyword length
            if (a.amount && !b.amount) return -1;
            if (!a.amount && b.amount) return 1;
            return b.keyword.length - a.keyword.length;
        });

        let newUncategorizedCount = 0;

        for (const transaction of transactions) {
            let matched = false;

            // Convert transaction details to lowercase for case-insensitive matching
            const lowerCaseDetails = transaction.details.toLowerCase();

            // Special case for Maverik or Chevron transactions (case-insensitive)
            if (lowerCaseDetails.includes('maverik') || lowerCaseDetails.includes('chevron')) {
                const transactionAmount = parseFloat(transaction.amount);
                let category;

                if (transactionAmount < 15) {
                    category = 'food';
                } else {
                    category = 'gas';
                }

                await addTransaction(transaction.date, transaction.details, transaction.amount, category);
                await notifyCategoryTransaction(category, transaction.amount);
                console.log(`Categorized Maverik or Chevron transaction: ${transaction.details} as ${category}`);
                matched = true;
                continue; // Skip further processing for this transaction
            }

            // Regular keyword-based matching
            for (const { keyword, category, amount } of keywords) {
                const keywordMatches = lowerCaseDetails.includes(keyword.toLowerCase());
                const amountMatches = amount === null || transaction.amount === amount;

                // Check if both keyword and amount match
                if (keywordMatches && amountMatches) {
                    await addTransaction(transaction.date, transaction.details, transaction.amount, category);
                    await notifyCategoryTransaction(category, transaction.amount);
                    console.log(`Categorized transaction found and added: ${transaction.details} with category ${category}`);
                    matched = true;
                    break;
                }
            }

            // If no match is found, add the transaction to the uncategorized list
            if (!matched) {
                await addUncategorizedTransaction(transaction.date, transaction.details, transaction.amount);
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

// Helper function to clean and convert strings to float
function cleanAndParseFloat(value) {
    const cleanedValue = value.replace(/[$,]/g, '').trim();
    return parseFloat(cleanedValue);
}

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

        if (!response || !response.data || response.data.valueRanges.length === 0) {
            throw new Error("Invalid response from Google Sheets");
        }

        const goalsData = response.data.valueRanges[0]?.values?.[0] || [];
        const sumsData = response.data.valueRanges[1]?.values?.[0] || [];
        let fillupPriceRaw = response.data.valueRanges[2]?.values?.[0]?.[0];

        fillupPriceRaw = fillupPriceRaw?.replace(/[$\s]/g, '');  // Remove dollar signs and spaces
        const fillupPrice = parseFloat(fillupPriceRaw);

        if (isNaN(fillupPrice)) {
            throw new Error("Invalid fill-up price");
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
            food: { total: foodBudget, used: foodUsed, remaining: foodBudget - foodUsed },
            shopping: { total: shoppingBudget, used: shoppingUsed, remaining: shoppingBudget - shoppingUsed },
            gas: { total: gasBudget, used: gasUsed, remaining: gasBudget - gasUsed },
            other: { total: otherBudget, used: otherUsed, remaining: otherBudget - otherUsed },
            fillupPrice,
        };
    } catch (error) {
        console.error('Error fetching budget data:', error.message);
        return { error: "Failed to fetch budget data" }; // Return a valid JSON response even on error
    }
}

function getPercentMonthPassed(date) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);  

    const daysInMonth = (monthEnd - monthStart) / (1000 * 60 * 60 * 24);
    const daysPassed = (now - monthStart) / (1000 * 60 * 60 * 24);

    return (daysPassed / daysInMonth) * 100;
}

// Notifications Logic

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

// Function to get the tithing amount from the Google Sheets
async function getTithingAmount() {
    const sheets = google.sheets({ version: 'v4', auth: client });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 = January, 1 = February, etc.

    const baseYear = 2024;
    const baseRow = 3; // February 2024 starts at row 3

    let rowToFetch = baseRow + (currentYear - baseYear) * 12 + currentMonth;

    const range = `Exp Expenses!C${rowToFetch}:C${rowToFetch}`; // Tithing is in column C

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
            range,
        });

        const tithingAmountRaw = response.data.values[0][0];
        const tithingAmount = cleanAndParseFloat(tithingAmountRaw);
        return tithingAmount;
    } catch (error) {
        console.error('Error fetching tithing amount:', error);
        return null;
    }
}

// Schedule Tithing Payments Function
function scheduleTithingPayments() {
    const rule = new schedule.RecurrenceRule();
    rule.dayOfWeek = 1; // Monday
    rule.date = [1, 2, 3, 4, 5, 6, 7]; // First seven days of the month
    rule.hour = 10;
    rule.minute = 0;
    rule.tz = 'America/Denver';

    const job = schedule.scheduleJob(rule, async function () {
        const now = new Date();

        if (now.getDate() <= 7 && now.getDay() === 1) {
            console.log('It\'s the first Monday of the month! Processing tithing payment...');

            const tithingAmount = await getTithingAmount();

            if (tithingAmount) {
                console.log(`Tithing amount to pay: ${tithingAmount}`);

                try {
                    await automateDonation(tithingAmount.toString());
                    console.log('Tithing payment successful.');
                } catch (err) {
                    console.error('Error during tithing automation:', err);
                }
            } else {
                console.error('No valid tithing amount found. Skipping payment.');
            }
        } else {
            console.log('Today is not the first Monday of the month. No tithing payment scheduled.');
        }
    });
}

async function getSavingsData() {
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    try {
        // Adjust this to match the actual range for savings data in the "Dashboard" tab
        const range = 'Dashboard!C29:E37'; // Assuming this range covers the savings categories from the image

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs', // Replace with your actual spreadsheet ID
            range: range,
        });

        if (!response || !response.data || response.data.values.length === 0) {
            throw new Error("No savings data found in Google Sheets");
        }

        // Assuming each category and amount are in separate cells
        const [emergency, general, future, treatYoSelf, vehicle, giftsDonations, travelVacation] = response.data.values.map(row => row[0]);

        const savingsData = {
            emergency,
            general,
            future,
            treatYoSelf,
            vehicle,
            giftsDonations,
            travelVacation,
        };

        return savingsData;

    } catch (error) {
        console.error('Error fetching savings data:', error.message);
        return { error: "Failed to fetch savings data" };
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
    try {
        const budgetData = await getBudgetData();
        res.json(budgetData);
    } catch (error) {
        console.error('Error fetching budget data:', error);
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
        processEmails(); 
        setInterval(processEmails, 1 * 60 * 1000); 
    }

    // Schedule the monthly tithing payments
    scheduleTithingPayments();
});