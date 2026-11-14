import { type Locator, type Page } from '@playwright/test';

export class EventHubLocators {
  constructor(private readonly page: Page) {}

  get registrationEmail(): Locator {
    return this.page.getByPlaceholder('you@email.com');
  }

  get registrationPassword(): Locator {
    return this.page.getByPlaceholder('Min 8 chars, uppercase, number & symbol');
  }

  get confirmPassword(): Locator {
    return this.page.getByPlaceholder('Repeat your password');
  }

  get createAccountButton(): Locator {
    return this.page.getByRole('button', { name: /create account/i });
  }

  get loginEmailCandidates(): Locator[] {
    return [this.page.getByPlaceholder('you@email.com'), this.page.locator('input[type="email"]')];
  }

  get loginPasswordCandidates(): Locator[] {
    return [this.page.getByPlaceholder(/password/i), this.page.locator('input[type="password"]')];
  }

  get signInButton(): Locator {
    return this.page.getByRole('button', { name: /sign in|log in/i });
  }

  get availableEventCard(): Locator {
    return this.page
      .getByTestId('event-card')
      .filter({ has: this.page.getByRole('link', { name: /book|register/i }) })
      .first();
  }

  get bookEventLink(): Locator {
    return this.availableEventCard.getByRole('link', { name: /book|register/i });
  }

  get ticketQuantity(): Locator {
    return this.page.locator('input[type="number"]').first();
  }

  get attendeeName(): Locator {
    return this.page.getByPlaceholder('Your full name');
  }

  get attendeeEmail(): Locator {
    return this.page.getByPlaceholder('you@email.com');
  }

  get attendeePhone(): Locator {
    return this.page.getByPlaceholder('+91 98765 43210');
  }

  get confirmBookingCandidates(): Locator[] {
    return [
      this.page.locator('.confirm-booking-btn'),
      this.page.getByRole('button', {
        name: /confirm booking|book now|complete registration/i,
      }),
    ];
  }

  get bookingConfirmation(): Locator {
    return this.page
      .getByText(/booking confirmed|booking successful|registration successful/i)
      .first();
  }

  async firstVisible(locators: Locator[], name: string): Promise<Locator> {
    for (const locator of locators) {
      try {
        await locator.first().waitFor({ state: 'visible', timeout: 3_000 });
        return locator.first();
      } catch {
        // Try the next supported control for this version of the practice app.
      }
    }

    throw new Error(`Could not find a visible ${name}.`);
  }
}
