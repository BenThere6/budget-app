const puppeteer = require('puppeteer');
require('dotenv').config();

async function automateDonation(tithingAmount = '1') {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    console.log("Browser launched...");

    await page.goto('https://id.churchofjesuschrist.org/oauth2/default/v1/authorize?scope=openid+profile+cmisid&sessionToken=&response_type=code&client_id=0oaxnk9mihwSrxIzV357&redirect_uri=https%3A%2F%2Fwww.churchofjesuschrist.org%2Fmy-home%2Fauth%2Fokta%2Fcallback&state=6336ce24-1948-4c4c-bb70-1cdec1eeb2ac', {
        waitUntil: 'networkidle2'
    });

    console.log("Navigated to login page.");

    const isLoggedIn = await page.$('#profile');
    if (isLoggedIn) {
        console.log('User is already logged in, proceeding to donations page.');
        await page.goto('https://donations.churchofjesuschrist.org/donations/#/donation/step1', { waitUntil: 'networkidle2' });
    } else {
        console.log('User is not logged in, proceeding with login process.');
        await page.type('#input28', process.env.CHURCH_USERNAME);
        await page.click('input.button-primary[type="submit"]');
        await page.waitForSelector('#input53');
        const password = process.env.CHURCH_PASSWORD;
        await page.type('#input53', password);
        await page.click('input.button-primary[type="submit"]');
        await page.waitForNavigation();
        console.log('Login successful, navigating to donations page.');
        await page.goto('https://donations.churchofjesuschrist.org/donations/#/donation/step1', { waitUntil: 'networkidle2' });
    }

    await page.waitForSelector('input[name="txt"]');
    await page.type('input[name="txt"]', tithingAmount);  // Use the provided tithing amount
    console.log(`Entered tithing amount: ${tithingAmount}`);

    try {
        await page.click('a[data-qa="nextStepButton"]');
        console.log('Successfully clicked Next Step button (direct).');
    } catch (error) {
        console.error('Direct click failed, trying via coordinates:', error);
        try {
            const nextStepButton = await page.$('a[data-qa="nextStepButton"]');
            const boundingBox = await nextStepButton.boundingBox();
            await page.mouse.click(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2);
            console.log('Clicked Next Step button via coordinates.');
        } catch (coordError) {
            console.error('Coordinate click failed:', coordError);
        }
    }

    console.log('Waiting for Next Step button on the bank account page...');

    async function attemptNextStepClick() {
        try {
            await page.waitForSelector('a[data-qa="nextStepButton"]:not(.display-hide)', { timeout: 30000 });
            console.log('Next Step button on bank account page is visible.');
            await page.evaluate(() => {
                const nextStepButton = document.querySelector('a[data-qa="nextStepButton"]');
                if (nextStepButton) {
                    nextStepButton.scrollIntoView();
                    nextStepButton.click();
                }
            });
            console.log('Clicked Next Step button via JavaScript.');
        } catch (error) {
            console.error('Failed with standard click:', error);
            console.log('Retrying Next Step click multiple times...');
            try {
                for (let i = 0; i < 3; i++) {
                    await page.click('a[data-qa="nextStepButton"]');
                    console.log(`Retry ${i + 1}: Clicked Next Step button.`);
                    await new Promise(resolve => setTimeout(resolve, 2000));  // delay between retries
                }
            } catch (retryError) {
                console.error('Retry click failed:', retryError);
            }
        }
    }

    async function waitForStepChange() {
        const maxRetries = 5;
        for (let i = 0; i < maxRetries; i++) {
            const currentUrl = await page.url();
            if (currentUrl.includes('/step2')) {
                console.log('Still on step 2 page, retrying Next Step click methods...');
                await attemptNextStepClick();
            } else if (currentUrl.includes('/step3')) {
                console.log('Successfully moved to step 3 page.');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 5000));  // 5 second delay between retries
        }
        console.log('Failed to move to step 3 after multiple retries.');
    }

    await waitForStepChange();

    const finalUrl = await page.url();
    if (finalUrl.includes('/step3')) {
        console.log('Waiting for Submit button...');
        try {
            await page.waitForSelector('a[data-qa="submitButton"]', { timeout: 30000 });
            await page.click('a[data-qa="submitButton"]');
            console.log('Clicked Submit button.');
        } catch (submitError) {
            console.error('Submit button click failed:', submitError);
        }

        // Check if the final confirmation page is loaded
        const confirmationUrl = 'https://donations.churchofjesuschrist.org/donations/#/donation/thankyou';
        const confirmationMessageSelector = 'h1.confirmation-message';  // Example selector for confirmation message

        try {
            // Wait for either the confirmation URL or a confirmation message
            await page.waitForFunction(
                `document.location.href === '${confirmationUrl}' || document.querySelector('${confirmationMessageSelector}')`,
                { timeout: 15000 }
            );
            console.log('Donation confirmed! Reached thank you page or found confirmation message.');
        } catch (confirmationError) {
            console.error('Donation confirmation not detected. It may still have been submitted, please verify manually.');
        }
    } else {
        console.log('Did not reach step 3, cannot proceed with submission.');
    }

    await browser.close();
    console.log('Donation process completed and browser closed.');
}

// Export the function for use in another file
module.exports = { automateDonation };

// Run the script if it's executed directly (e.g., via "node tithing.js")
if (require.main === module) {
    // Default tithing amount is "1" if no amount is provided via command line arguments
    const tithingAmount = process.argv[2] || '1';
    automateDonation(tithingAmount).then(() => {
        console.log('Automation finished');
    }).catch(err => {
        console.error('Error during the automation:', err);
    });
}