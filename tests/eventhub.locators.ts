import { type Locator, type Page } from '@playwright/test';

function xpathLiteral(value: string): string {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;

  return `concat(${value.split("'").map((part) => `'${part}'`).join(', "\'", ')})`;
}

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

  get bookingConfirmationDetails(): Locator {
    return this.page.locator(
      "xpath=//div[contains(concat(' ', normalize-space(@class), ' '), ' bg-indigo-50 ') and contains(concat(' ', normalize-space(@class), ' '), ' border-indigo-100 ') and contains(concat(' ', normalize-space(@class), ' '), ' rounded-xl ') and contains(concat(' ', normalize-space(@class), ' '), ' p-4 ') and contains(concat(' ', normalize-space(@class), ' '), ' mb-5 ') and contains(concat(' ', normalize-space(@class), ' '), ' text-left ') and contains(concat(' ', normalize-space(@class), ' '), ' space-y-2 ')]",
    ).first();
  }

  get bookingReference(): Locator {
    // Equivalent to the supplied confirmation XPath, but tolerant of a
    // different CSS-class ordering on the panel.
    return this.bookingConfirmationDetails.locator('xpath=.//div[1]').first();
  }

  bookingCustomerName(customerName: string): Locator {
    return this.bookingConfirmationDetails.locator(
      `xpath=.//span[normalize-space()=${xpathLiteral(customerName)}]`,
    ).first();
  }

  bookingTicketsQuantity(quantity: number): Locator {
    return this.bookingConfirmationDetails.locator(
      `xpath=.//span[normalize-space()=${xpathLiteral(String(quantity))}]`,
    ).first();
  }

  get bookingTotalPrice(): Locator {
    return this.bookingConfirmationDetails.locator(
      "xpath=.//div[span[normalize-space()='Total']]/span[contains(concat(' ', normalize-space(@class), ' '), ' font-medium ') and contains(concat(' ', normalize-space(@class), ' '), ' text-gray-900 ')]",
    ).first();
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
