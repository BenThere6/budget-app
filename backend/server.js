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

    // Define your spreadsheet ID and the range you want to access
    const spreadsheetId = '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs'; // Replace with your actual Google Sheets ID
    const range = 'Dashboard!A1:H40'; // Replace with your desired range

    // Reading data from Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: range,
    });

    const rows = response.data.values;
    if (rows.length) {
      console.log('Data from sheet:');
      rows.map((row) => {
        console.log(`${row.join(', ')}`);
      });
    } else {
      console.log('No data found.');
    }

    // Writing data to Google Sheets
    // const values = [
    //   ['New Data 1', 'New Data 2'],
    //   ['More Data 1', 'More Data 2'],
    // ];
    // const resource = {
    //   values,
    // };
    // const writeResponse = await sheets.spreadsheets.values.update({
    //   spreadsheetId: spreadsheetId,
    //   range: 'Sheet1!A2', // Adjust the range to where you want to write
    //   valueInputOption: 'RAW',
    //   resource,
    // });

    // console.log('%d cells updated.', writeResponse.data.updatedCells);
  } catch (err) {
    console.error('Error accessing the Google Sheets API:', err);
  }
}

// Call the function
accessSpreadsheet();