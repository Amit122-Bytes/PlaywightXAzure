import { createHash, createHmac } from 'node:crypto';

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

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const tableName = process.env.AZURE_STORAGE_TABLE || 'playwrighttestresults';
const defaultRunId = `${new Date().toISOString().replace(/[-:.]/g, '')}-${process.pid}`;

function parseConnectionString(value: string) {
  const settings = Object.fromEntries(
    value.split(';').filter(Boolean).map((part) => {
      const separator = part.indexOf('=');
      return [part.slice(0, separator), part.slice(separator + 1)];
    }),
  );

  if (!settings.AccountName || !settings.AccountKey) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING must contain AccountName and AccountKey.');
  }

  return {
    accountKey: settings.AccountKey,
    accountName: settings.AccountName,
    tableEndpoint: settings.TableEndpoint || `${settings.DefaultEndpointsProtocol || 'https'}://${settings.AccountName}.table.core.windows.net`,
  };
}

function assertTableName(value: string): void {
  if (!/^[A-Za-z][A-Za-z0-9]{2,62}$/.test(value)) {
    throw new Error('AZURE_STORAGE_TABLE must be 3-63 alphanumeric characters and begin with a letter.');
  }
}

const storage = connectionString ? parseConnectionString(connectionString) : undefined;
let tableCreation: Promise<void> | undefined;

function headers(method: string, resource: string, body?: string): HeadersInit {
  if (!storage) throw new Error('AZURE_STORAGE_CONNECTION_STRING is required to save booking data to Azure Table Storage.');

  const requestDate = new Date().toUTCString();
  const contentType = body ? 'application/json' : '';
  // Azure Table Storage uses a different Shared Key signature format from Blob
  // Storage: it signs the request date and resource, not x-ms headers.
  const stringToSign = [
    method,
    '',
    contentType,
    requestDate,
    `/${storage.accountName}/${resource}`,
  ].join('\n');
  const signature = createHmac('sha256', Buffer.from(storage.accountKey, 'base64'))
    .update(stringToSign, 'utf8')
    .digest('base64');

  return {
    Accept: 'application/json;odata=nometadata',
    Authorization: `SharedKey ${storage.accountName}:${signature}`,
    'Content-Type': contentType,
    'DataServiceVersion': '3.0',
    'MaxDataServiceVersion': '3.0;NetFx',
    'x-ms-date': requestDate,
    'x-ms-version': '2019-02-02',
  };
}

async function request(method: string, resource: string, body?: string): Promise<Response> {
  if (!storage) throw new Error('AZURE_STORAGE_CONNECTION_STRING is required to save booking data to Azure Table Storage.');

  const response = await fetch(`${storage.tableEndpoint.replace(/\/+$/, '')}/${resource}`, {
    method,
    headers: headers(method, resource, body),
    body,
  });
  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    const error = new Error(`Azure Table request failed (${response.status} ${response.statusText}): ${details}`) as Error & { statusCode?: number };
    error.statusCode = response.status;
    throw error;
  }
  return response;
}

async function ensureTable(): Promise<void> {
  if (tableCreation) return tableCreation;

  tableCreation = (async () => {
    try {
      await request('POST', 'Tables', JSON.stringify({ TableName: tableName }));
      console.log(`Created Azure Table: ${tableName}`);
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 409) throw error;
    }
  })();
  return tableCreation;
}

export async function storeBookingConfirmation(confirmation: BookingConfirmation): Promise<void> {
  if (!storage) throw new Error('AZURE_STORAGE_CONNECTION_STRING is required to save booking data to Azure Table Storage.');
  assertTableName(tableName);
  await ensureTable();

  const partitionKey = process.env.AZURE_TABLE_RUN_ID || defaultRunId;
  const rowKey = `booking-${createHash('sha256').update(`${partitionKey}:${confirmation.bookingReference}`).digest('hex')}`;
  const entity = {
    PartitionKey: partitionKey,
    RowKey: rowKey,
    BookingReference: confirmation.bookingReference,
    CustomerName: confirmation.customerName,
    TicketsQuantity: confirmation.ticketsQuantity,
    TotalPrice: confirmation.totalPrice,
    ...(confirmation.totalPriceAmount !== undefined ? { TotalPriceAmount: confirmation.totalPriceAmount } : {}),
    CapturedAt: confirmation.capturedAt,
    TestFile: confirmation.testFile,
    TestTitle: confirmation.testTitle,
    BookingPayload: JSON.stringify(confirmation),
  };

  await request('POST', tableName, JSON.stringify(entity));
  console.log(`Stored booking ${confirmation.bookingReference} in Azure Table: ${tableName}.`);
}
