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

// Function to check emails
function checkEmails() {
    return new Promise((resolve, reject) => {
        const mail = new imap(imapConfig);

        mail.once('ready', () => {
            mail.openBox('INBOX', false, () => {
                mail.search([['FROM', 'noreply@alert.macu.com'], ['SUBJECT', 'Transaction Alert from Mountain America Credit Union']], (err, results) => {
                    if (err) {
                        return reject(err);
                    }

                    if (!results || !results.length) {
                        console.log('No emails found.');
                        mail.end();
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
                                            console.error('Error parsing email:', err);
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

        // Extract the amount
        const amount = $(element).find('td.amount').text().trim();

        transactions.push({ date: formattedDate, details, amount });
    });

    return transactions;
}

// Route to check emails and log transactions
app.get('/check-emails', async (req, res) => {
    try {
        const transactions = await checkEmails();
        if (transactions.length > 0) {
            console.log('Transactions found:');
            transactions.forEach(transaction => console.log(transaction));
        } else {
            console.log('No transactions found.');
        }
        res.json({ message: 'Email check completed.', transactions });
    } catch (err) {
        console.error('Error checking emails:', err);
        res.status(500).json({ error: 'Failed to check emails' });
    }
});

// Automatically check emails every 5 minutes
setInterval(async () => {
    try {
        console.log('Checking for new emails...');
        const transactions = await checkEmails();
        if (transactions.length > 0) {
            console.log('Transactions found:');
            transactions.forEach(transaction => console.log(transaction));
        } else {
            console.log('No transactions found.');
        }
    } catch (err) {
        console.error('Error checking emails:', err);
    }
}, 10 * 1000); // 10 seconds converted to ms

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});