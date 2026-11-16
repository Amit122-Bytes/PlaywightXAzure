# Store confirmed bookings in Azure Table Storage

This lab saves each confirmed EventHub booking directly from the Playwright
test into Azure Table Storage. No booking JSON file is saved locally.

Each table entity contains fields that you can query and a `BookingPayload`
property containing the complete JSON confirmation.

```text
playwrighttestresults
| PartitionKey (test run) | RowKey (unique booking) | BookingReference | CustomerName | TicketsQuantity | TotalPrice
```

`PartitionKey` groups booking results from one test process. `RowKey` makes an
entity unique within that partition. The other values are the entity payload.

## 1. Create the table in Azure Portal

1. Sign in to [Azure Portal](https://portal.azure.com).
2. Create a **Storage account** (Standard and LRS are suitable for this lab).
3. Open the account, select **Storage browser** > **Tables** > **Add table**.
4. Name it `playwrighttestresults`.
5. Open **Access keys**, reveal `key1`, and copy its **Connection string**.

Keep the connection string private. Do not commit it to Git.

## 2. Configure PowerShell

In the same PowerShell window that will run the test:

```powershell
$env:AZURE_STORAGE_CONNECTION_STRING = "<paste-your-connection-string>"
$env:AZURE_STORAGE_TABLE = "playwrighttestresults" # optional; this is the default
```

## 3. Run the booking test

```powershell
npm run test:eventhub:table -- --headed
```

After the booking confirmation page shows its reference, customer, quantity,
and total, the test sends one entity directly to Azure Table Storage.

The entity includes values similar to:

```json
{
  "PartitionKey": "20261116T...-1234",
  "RowKey": "booking-...",
  "BookingReference": "D-38F8QP",
  "CustomerName": "Test",
  "TicketsQuantity": 1,
  "TotalPrice": "$300",
  "TotalPriceAmount": 300,
  "BookingPayload": "{...complete JSON confirmation...}"
}
```

If the table does not exist yet, the test creates it automatically. If Azure
returns an error, the test fails so a missing booking record cannot be ignored.

## 4. Query results in Azure Portal

1. Open the storage account in Azure Portal.
2. Select **Storage browser** > **Tables** > `playwrighttestresults`.
3. Select **Query**.
4. To see all bookings from one run, filter by its partition key:

```text
PartitionKey eq '20261116T...-1234'
```

To find a booking by reference:

```text
BookingReference eq 'D-38F8QP'
```

You can open an entity to inspect its individual properties or the full
`BookingPayload` JSON.

## Troubleshooting

- **`AZURE_STORAGE_CONNECTION_STRING is required`**: set the variable in the
  same PowerShell window before running the test.
- **HTTP 403**: copy a fresh connection string from the intended storage
  account and check that Shared Key access is enabled.
- **Table name error**: use a name with 3-63 letters/numbers that begins with
  a letter.
- **No entity appears**: check the Playwright output. The test fails if the
  booking confirmation cannot be captured or saved.

## Reference

- [Azure Table Storage REST API](https://learn.microsoft.com/rest/api/storageservices/table-service-rest-api)
