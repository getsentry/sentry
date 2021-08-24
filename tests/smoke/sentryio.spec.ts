const {test, expect} = require('@playwright/test');

test('sentryio', async ({page}) => {
  // Go to https://sentry.io/
  await page.goto('https://sentry.io/');
  expect(page.url()).toBe('https://sentry.io/welcome/');

  // Click text=I Accept
  await page.click('text=I Accept');

  // Click a:has-text("Sign In")
  await page.click('a:has-text("Sign In")');
  await page.waitForURL('https://sentry.io/auth/login/');

  // Click text=Single Sign-On
  await page.click('a[href="#sso"]');

  // Click [placeholder="acme"]
  await page.click('[placeholder="acme"]');

  // Fill [placeholder="acme"]
  await page.fill('[placeholder="acme"]', 'sentry');

  // Click #sso >> text=Continue
  await page.click('#sso >> text=Continue');
  expect(page.url()).toBe('https://sentry.io/auth/login/sentry/');

  // Click text=Login with Google
  await page.click('text=Login with Google');
  await page.waitForURL('https://accounts.google.com/**/*');

  // Close page
  await page.close();
});
