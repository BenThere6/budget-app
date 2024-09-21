const puppeteer = require('puppeteer');
require('dotenv').config();

async function automateDonation() {
    const browser = await puppeteer.launch({ headless: false });  // Set headless to false for debugging
    const page = await browser.newPage();

    // Step 1: Navigate to the login page or homepage (if already logged in)
    await page.goto('https://id.churchofjesuschrist.org/oauth2/default/v1/authorize?scope=openid+profile+cmisid&sessionToken=&response_type=code&client_id=0oaxnk9mihwSrxIzV357&redirect_uri=https%3A%2F%2Fwww.churchofjesuschrist.org%2Fmy-home%2Fauth%2Fokta%2Fcallback&state=6336ce24-1948-4c4c-bb70-1cdec1eeb2ac', {
        waitUntil: 'networkidle2'  // Wait for the network to be idle before proceeding
    });

    // Step 2: Check if user is already logged in by checking for profile picture
    const isLoggedIn = await page.$('#profile');  // Checks for profile button (exists if logged in)
    
    if (isLoggedIn) {
        console.log('User is already logged in, proceeding to donations page.');

        // Step 3: Go directly to the donations page
        await page.goto('https://donations.churchofjesuschrist.org/donations/#/donation/step1', {
            waitUntil: 'networkidle2'
        });

    } else {
        console.log('User is not logged in, proceeding with login process.');

        // Step 4: Perform login if user is not already logged in
        await page.type('#input28', 'benjaminbirdsall');  // Use the ID of the username field
        await page.click('input.button-primary[type="submit"]');  // Click the "Next" button

        // Wait for the password field to appear, then enter password
        await page.waitForSelector('#input53');
        const password = process.env.CHURCH_PASSWORD || 'default_password_here';
        await page.type('#input53', password);  // Use the ID of the password field
        await page.click('input.button-primary[type="submit"]');  // Click the "Verify" button

        // Wait for login to complete and redirect
        await page.waitForNavigation();

        // Step 5: Navigate to the donations page after login
        await page.goto('https://donations.churchofjesuschrist.org/donations/#/donation/step1', {
            waitUntil: 'networkidle2'
        });
    }

    // Step 6: Wait for the tithing field to appear
    await page.waitForSelector('input[name="txt"]');
    await page.type('input[name="txt"]', '1');  // Use the 'name' attribute for tithing input

    // Step 7: Click "Next Step" for the tithing amount
    await page.click('a[data-qa="nextStepButton"]');  // Click the "Next Step" button for tithing

    // Step 8: Ensure the "Next Step" button on the bank account page is visible and interactable using evaluate
    await page.waitForSelector('a[data-qa="nextStepButton"]:not(.display-hide)', { timeout: 60000 });  // Ensure button is visible
    
    await page.evaluate(() => {
        const nextStepButton = document.querySelector('a[data-qa="nextStepButton"]');
        if (nextStepButton && !nextStepButton.classList.contains('display-hide')) {
            nextStepButton.click();
        } else {
            throw new Error("Next Step button is not visible or enabled");
        }
    });

    // Step 9: Wait for the "Submit" button to appear and click it
    await page.waitForSelector('a[data-qa="submitButton"]', { timeout: 60000 });  // Wait longer for the button
    await page.click('a[data-qa="submitButton"]');

    // Close the browser after submission
    await browser.close();
}

automateDonation().then(() => {
    console.log('Donation submitted successfully');
}).catch(err => {
    console.error('Error during the automation:', err);
});