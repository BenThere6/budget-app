const puppeteer = require('puppeteer');
require('dotenv').config();

async function automateDonation() {
    const browser = await puppeteer.launch({ headless: false });  // Set headless to false for debugging
    const page = await browser.newPage();

    console.log("Browser launched...");

    // Step 1: Navigate to the login page or homepage (if already logged in)
    await page.goto('https://id.churchofjesuschrist.org/oauth2/default/v1/authorize?scope=openid+profile+cmisid&sessionToken=&response_type=code&client_id=0oaxnk9mihwSrxIzV357&redirect_uri=https%3A%2F%2Fwww.churchofjesuschrist.org%2Fmy-home%2Fauth%2Fokta%2Fcallback&state=6336ce24-1948-4c4c-bb70-1cdec1eeb2ac', {
        waitUntil: 'networkidle2'
    });

    console.log("Navigated to login page.");

    // Step 2: Check if user is already logged in by checking for profile picture
    const isLoggedIn = await page.$('#profile');

    if (isLoggedIn) {
        console.log('User is already logged in, proceeding to donations page.');
        await page.goto('https://donations.churchofjesuschrist.org/donations/#/donation/step1', {
            waitUntil: 'networkidle2'
        });
    } else {
        console.log('User is not logged in, proceeding with login process.');
        await page.type('#input28', 'benjaminbirdsall'); 
        console.log('Entered username.');
        await page.click('input.button-primary[type="submit"]');
        console.log('Clicked Next button.');

        // Wait for the password field to appear, then enter password
        await page.waitForSelector('#input53');
        console.log('Password field is visible.');

        const password = process.env.CHURCH_PASSWORD || 'default_password_here';
        await page.type('#input53', password);
        console.log('Entered password.');

        await page.click('input.button-primary[type="submit"]');
        console.log('Clicked Verify button.');

        await page.waitForNavigation();
        console.log('Login successful, navigating to donations page.');
        await page.goto('https://donations.churchofjesuschrist.org/donations/#/donation/step1', {
            waitUntil: 'networkidle2'
        });
    }

    console.log('Reached donation step 1.');

    // Step 6: Wait for the tithing field to appear
    await page.waitForSelector('input[name="txt"]');
    console.log('Tithing field is visible.');
    await page.type('input[name="txt"]', '1');
    console.log('Entered tithing amount.');

    // Step 7: Click "Next Step" for the tithing amount
    console.log('Attempting to click Next Step button for tithing amount...');
    try {
        await page.click('a[data-qa="nextStepButton"]');
        console.log('Successfully clicked Next Step button (direct).');
    } catch (error) {
        console.error('Direct click failed, trying to click based on coordinates:', error);
        try {
            const nextStepButton = await page.$('a[data-qa="nextStepButton"]');
            const boundingBox = await nextStepButton.boundingBox();
            await page.mouse.click(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2);
            console.log('Clicked Next Step button via coordinates.');
        } catch (coordError) {
            console.error('Coordinate click failed:', coordError);
        }
    }

    // Step 8: Handle the "Next Step" button on the bank account page
    console.log('Waiting for Next Step button on the bank account page to be visible...');

    async function attemptNextStepClick() {
        try {
            // Method 1: Standard Click with scroll into view
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
            console.error('Failed with standard click and scroll:', error);

            // Method 2: Retry Clicking multiple times
            console.log('Retrying clicking Next Step button multiple times...');
            try {
                for (let i = 0; i < 3; i++) {
                    await page.click('a[data-qa="nextStepButton"]');
                    console.log(`Retry ${i + 1}: Clicked Next Step button.`);
                    await page.waitForTimeout(1000);  // Short delay between retries
                }
            } catch (retryError) {
                console.error('Retry click failed:', retryError);

                // Method 3: Force Click with JavaScript manipulation
                console.log('Trying to force click Next Step button via DOM manipulation...');
                try {
                    await page.evaluate(() => {
                        const nextStepButton = document.querySelector('a[data-qa="nextStepButton"]');
                        if (nextStepButton) {
                            nextStepButton.removeAttribute('disabled');  // Force enable button
                            nextStepButton.click();
                        }
                    });
                    console.log('Force clicked Next Step button.');
                } catch (forceError) {
                    console.error('Force click failed:', forceError);

                    // Method 4: Double-click the button
                    console.log('Trying to double-click the Next Step button...');
                    try {
                        await page.evaluate(() => {
                            const nextStepButton = document.querySelector('a[data-qa="nextStepButton"]');
                            if (nextStepButton) {
                                const clickEvent = new MouseEvent('dblclick', {
                                    view: window,
                                    bubbles: true,
                                    cancelable: true
                                });
                                nextStepButton.dispatchEvent(clickEvent);
                            }
                        });
                        console.log('Successfully double-clicked the Next Step button.');
                    } catch (doubleClickError) {
                        console.error('Double-click failed:', doubleClickError);

                        // Method 5: Hover and click
                        console.log('Hovering over the button and trying click...');
                        try {
                            const nextStepButton = await page.$('a[data-qa="nextStepButton"]');
                            await nextStepButton.hover();
                            await page.waitForTimeout(500);
                            await nextStepButton.click();
                            console.log('Hovered and clicked the Next Step button.');
                        } catch (hoverError) {
                            console.error('Hover and click failed:', hoverError);

                            // Method 6: Press Enter as last resort
                            console.log('Pressing Enter as fallback...');
                            await page.keyboard.press('Enter');
                        }
                    }
                }
            }
        }
    }

    await attemptNextStepClick();

    // Check if URL is still step 2
    const currentUrl = await page.url();
    if (currentUrl.includes('/donation/step2')) {
        console.log('Still on step 2 page, retrying Next Step click methods...');
        await attemptNextStepClick();
    } else {
        console.log('Successfully moved to step 3 page.');
        // Step 9: Wait for the "Submit" button to appear and click it
        console.log('Waiting for Submit button...');
        try {
            await page.waitForSelector('a[data-qa="submitButton"]', { timeout: 30000 });
            await page.click('a[data-qa="submitButton"]');
            console.log('Clicked Submit button.');
        } catch (submitError) {
            console.error('Submit button click failed:', submitError);
        }

        // Final Step: Check if donation confirmation appears
        console.log('Checking for donation confirmation...');
        try {
            await page.waitForSelector('h1.confirmation-message', { timeout: 30000 });
            console.log('Donation confirmed!');
        } catch (confirmationError) {
            console.error('Donation confirmation not detected. Submission may have failed:', confirmationError);
        }
    }

    // Close the browser after submission
    await browser.close();
    console.log('Donation process completed and browser closed.');
}

automateDonation().then(() => {
    console.log('Automation finished');
}).catch(err => {
    console.error('Error during the automation:', err);
});