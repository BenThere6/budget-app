const express = require('express');
const { google } = require('googleapis');
const imap = require('imap');
const cheerio = require('cheerio');
const { simpleParser } = require('mailparser');
const keys = require('./service-account-key.json');
require('dotenv').config();

// Initialize Express app
const app = express();
const port = 3009;

// Middleware to parse JSON bodies
app.use(express.json());

// Set up the JWT client using the service account key
const client = new google.auth.JWT(
    keys.client_email,
    null,
    keys.private_key,
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
            range: 'Keywords!A:B', // Adjust the range if necessary
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
            range: 'Transactions!A:D', // Adjust the range if necessary
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
            range: 'Uncategorized!A:D', // Adjust the range if necessary
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

                    const fetch = mail.fetch(results, { bodies: '' });
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
                    });

                    fetch.once('end', async () => {
                        await Promise.all(parsePromises); // Ensure all parsing is complete
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
// Function to parse transaction details from the email HTML content
function parseTransactionDetails(html) {
    const $ = cheerio.load(html);
    const transactions = [];

    // Find the table that contains the transaction rows
    $('table.transactions tbody tr.transaction-row').each((index, element) => {
        // Extract the date
        const dateRaw = $(element).find('td.date').text().trim().replace(/\s+/g, ' ');

        // Format the date
        const [month, day, year] = dateRaw.match(/\b[A-Z][a-z]+|\d{2,4}/g);
        const monthNumber = new Date(`${month} 1`).getMonth() + 1; // Convert month name to number
        const formattedDate = `${monthNumber}/${day}/${year.slice(-2)}`;

        // Extract the transaction details
        const details = $(element).find('td.details').text().trim();

        // Extract the amount and format it
        let amount = $(element).find('td.amount').text().trim();

        // Remove any parentheses and ensure it has two decimal places
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
                    await addTransaction(transaction.date, transaction.details, transaction.amount, category); // Ensure this is awaited
                    console.log(`Categorized transaction found and added: ${transaction.details}`);
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                await addUncategorizedTransaction(transaction.date, transaction.details, transaction.amount); // Ensure this is awaited
                console.log(`Uncategorized transaction found and added: ${transaction.details}`);
            }
        }

    } catch (err) {
        console.error('Error during automatic email check:', err);
    }
}

// Start the server and initiate email checking immediately
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    processEmails(); // Check emails immediately upon server start
    setInterval(processEmails, 5 * 60 * 1000); // Check emails every 5 minutes
});