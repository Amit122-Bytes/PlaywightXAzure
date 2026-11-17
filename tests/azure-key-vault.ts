import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);
const apiVersion = '7.4';

export type BookingConfirmation = {
  bookingReference: string;
  customerName: string;
  ticketsQuantity: number;
  totalPrice: string;
  totalPriceAmount?: number;
  capturedAt: string;
  testFile: string;
  testTitle: string;
};

function keyVaultName(): string {
  const value = process.env.AZURE_KEY_VAULT_NAME;
  if (!value) {
    throw new Error('AZURE_KEY_VAULT_NAME is required to store the booking confirmation in Azure Key Vault.');
  }
  if (!/^(?=.{3,24}$)[a-zA-Z](?:[a-zA-Z0-9]|-(?!-))*[a-zA-Z0-9]$/.test(value)) {
    throw new Error('AZURE_KEY_VAULT_NAME is not a valid Key Vault name.');
  }
  return value;
}

function secretName(): string {
  const value = process.env.AZURE_KEY_VAULT_SECRET_NAME || 'booking-confirmation';
  if (!/^[0-9a-zA-Z-]{1,127}$/.test(value)) {
    throw new Error('AZURE_KEY_VAULT_SECRET_NAME must contain only letters, numbers, or hyphens.');
  }
  return value;
}

async function accessToken(): Promise<string> {
  try {
    const args = [
      'account', 'get-access-token',
      '--resource', 'https://vault.azure.net',
      '--query', 'accessToken',
      '--output', 'tsv',
      '--only-show-errors',
    ];
    // Azure CLI installs as az.cmd on Windows. execFile cannot execute .cmd
    // files there, whereas exec invokes cmd.exe and supports the CLI normally.
    const result = process.platform === 'win32'
      ? await execAsync(`az ${args.join(' ')}`, { windowsHide: true })
      : await execFileAsync('az', args, { windowsHide: true });
    const { stdout } = result;
    const token = stdout.trim();
    if (token) return token;
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not obtain an Azure access token from Azure CLI: ${details}`);
  }
  throw new Error('Azure CLI returned an empty Azure access token. Run "az login" before this test.');
}

async function keyVaultRequest(url: string, init: RequestInit, token: string): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    throw new Error(`Azure Key Vault request failed (${response.status} ${response.statusText}): ${details}`);
  }
  return response;
}

/**
 * Setting an existing secret name creates a new Key Vault version. No booking
 * confirmation is written to the local file system or passed on a command line.
 */
export async function storeBookingConfirmationInKeyVault(confirmation: BookingConfirmation): Promise<void> {
  const vault = keyVaultName();
  const secret = secretName();
  const token = await accessToken();
  const secretUrl = `https://${vault}.vault.azure.net/secrets/${encodeURIComponent(secret)}?api-version=${apiVersion}`;
  const value = JSON.stringify(confirmation);

  const created = await keyVaultRequest(secretUrl, {
    method: 'PUT',
    body: JSON.stringify({
      value,
      contentType: 'application/json',
      tags: {
        source: 'eventhub-playwright',
        bookingReference: confirmation.bookingReference,
      },
    }),
  }, token);
  const createdSecret = await created.json() as { id?: string };

  // A request without a version returns the latest version of the secret.
  const latest = await keyVaultRequest(secretUrl, { method: 'GET' }, token);
  const latestSecret = await latest.json() as { value?: string };
  if (latestSecret.value !== value) {
    throw new Error('Azure Key Vault did not return the booking confirmation that was just stored.');
  }

  console.log(`Stored booking ${confirmation.bookingReference} in Azure Key Vault: ${createdSecret.id}`);
}
