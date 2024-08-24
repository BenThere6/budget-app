const { google } = require('googleapis');
const keys = require('./service-account-key.json'); // Replace with the path to your JSON file

// Set up the JWT client using the service account key
const client = new google.auth.JWT(
  keys.client_email,
  null,
  keys.private_key,
  ['https://www.googleapis.com/auth/spreadsheets'] // This scope gives full access to the Google Sheets API
);

// Function to access Google Sheets and retrieve data
async function accessSpreadsheet() {
  try {
    // Authenticate the JWT client
    await client.authorize();

    // Create a Google Sheets API instance
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Define your spreadsheet ID
    const spreadsheetId = '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs'; // Replace with your actual Google Sheets ID

    // Define the ranges you want to pull data from
    const ranges = [
      'Dashboard!C19', // Food budget remainder
      'Dashboard!E19', // Shopping budget remainder
      'Dashboard!G19', // Gas budget remainder
      'Dashboard!C23', // Other budget remainder
    ];

    // Fetch the data for the specified ranges
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: spreadsheetId,
      ranges: ranges,
    });

    const values = response.data.valueRanges.map(range => range.values ? range.values[0][0] : 'No data');

    console.log('Budget Remainders:');
    console.log(`Food: ${values[0]}`);
    console.log(`Shopping: ${values[1]}`);
    console.log(`Gas: ${values[2]}`);
    console.log(`Other: ${values[3]}`);
  } catch (err) {
    console.error('Error accessing the Google Sheets API:', err);
  }
}

// Function to add a new transaction
async function addTransaction(date, category, amount, details) {
  try {
    // Authenticate the JWT client
    await client.authorize();

    // Create a Google Sheets API instance
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Define your spreadsheet ID and range for the Transactions tab
    const spreadsheetId = '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs'; // Replace with your actual Google Sheets ID
    const range = 'Transactions!A:D';

    // Get the current data in the Transactions tab to find the next available row
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: range,
    });

    const numRows = getResponse.data.values ? getResponse.data.values.length : 0;
    const nextRow = numRows + 1;

    // Define the data to be written
    const values = [
      [date, category, amount, details],
    ];

    // Define the resource for the update
    const resource = {
      values,
    };

    // Write the data to the next available row in the Transactions tab
    const writeResponse = await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `Transactions!A${nextRow}:D${nextRow}`,
      valueInputOption: 'RAW',
      resource: resource,
    });

    console.log(`Transaction added. ${writeResponse.data.updatedCells} cells updated.`);
  } catch (err) {
    console.error('Error adding transaction to Google Sheets:', err);
  }
}

// Call the function to read the budget data
accessSpreadsheet();