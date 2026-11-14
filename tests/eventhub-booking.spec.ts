import { expect, test, type Page } from '@playwright/test';
import { EventHubLocators } from './eventhub.locators';
import { createBookingTestData, eventHub } from './eventhub.test-data';

async function captureStep(page: Page, runId: number, step: string): Promise<void> {
  await page.screenshot({
    path: `screenshots/${runId}-${step}.png`,
    fullPage: true,
  });
}

test('EventHub - fresh user can book an available event', async ({ page }) => {
  test.setTimeout(90_000);

  const testData = createBookingTestData(Date.now());
  const { email, runId } = testData;
  const locators = new EventHubLocators(page);

  await test.step('Register a sandbox account', async () => {
    await page.goto(`${eventHub.baseURL}/register`, { waitUntil: 'domcontentloaded' });

    await expect(locators.createAccountButton).toBeVisible();

    await locators.registrationEmail.fill(email);
    await locators.registrationPassword.fill(eventHub.password);
    await locators.confirmPassword.fill(eventHub.password);

    const registrationResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/auth\/register\/?$/.test(new URL(response.url()).pathname),
    );
    await locators.createAccountButton.click();
    expect((await registrationResponse).ok()).toBeTruthy();
    await captureStep(page, runId, '01-registration');
  });

  await test.step('Sign in when registration does not create a session', async () => {
    // Registration may create a session immediately. Visiting the protected route
    // tells us conclusively whether a sign-in is still required.
    await page.goto(`${eventHub.baseURL}/events`, { waitUntil: 'domcontentloaded' });

    if (!page.url().includes('/login')) {
      await captureStep(page, runId, '02-authenticated-session');
      return;
    }

    const emailInput = await locators.firstVisible(
      locators.loginEmailCandidates,
      'sign-in email field',
    );
    const passwordInput = await locators.firstVisible(
      locators.loginPasswordCandidates,
      'sign-in password field',
    );

    await emailInput.fill(email);
    await passwordInput.fill(eventHub.password);

    const loginResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/auth\/login\/?$/.test(new URL(response.url()).pathname),
    );
    await locators.signInButton.click();
    expect((await loginResponse).ok()).toBeTruthy();
    await page.goto(`${eventHub.baseURL}/events`, { waitUntil: 'domcontentloaded' });
    await captureStep(page, runId, '02-login');
  });

  await test.step('Open an available event', async () => {
    await expect(locators.availableEventCard).toBeVisible();
    await locators.bookEventLink.click();
    await captureStep(page, runId, '03-event-selected');
  });

  await test.step('Book one ticket', async () => {
    if (await locators.ticketQuantity.count()) {
      await locators.ticketQuantity.fill('1');
    }

    await locators.attendeeName.fill(eventHub.attendee.fullName);
    await locators.attendeeEmail.fill(email);
    await locators.attendeePhone.fill(eventHub.attendee.phone);

    const confirmBooking = await locators.firstVisible(
      locators.confirmBookingCandidates,
      'booking confirmation button',
    );

    await expect(confirmBooking).toBeEnabled();
    await confirmBooking.click();
    await captureStep(page, runId, '04-booking-submitted');
  });

  await test.step('Verify the booking confirmation', async () => {
    await expect(locators.bookingConfirmation).toBeVisible();
    await captureStep(page, runId, '05-booking-confirmed');
  });
});
