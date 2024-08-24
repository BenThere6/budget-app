const { google } = require('googleapis');
const keys = require('./service-account-key.json'); // Replace with the path to your JSON file

// Set up the JWT client using the service account key
const client = new google.auth.JWT(
  keys.client_email,
  null,
  keys.private_key,
  ['https://www.googleapis.com/auth/spreadsheets'] // This scope gives full access to the Google Sheets API
);

// Function to access Google Sheets
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

// Call the function
accessSpreadsheet();