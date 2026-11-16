# Automatically store Playwright artifacts in Azure Blob Storage

Every `npm test` run uploads its new artifacts to a private Azure Blob container:

- `screenshots/` - full-page screenshots captured by the EventHub test.
- `playwright-report/` - the Playwright HTML report and its supporting files.
- `test-results/` - failure-only trace, screenshot, and error-context artifacts.

Each test run receives a separate Blob prefix:

```text
playwright-artifacts
`-- runs
    `-- 20261107T103015Z-12345
        |-- screenshots
        |-- report
        `-- test-results
```

## One-time: create storage manually in the Azure portal

You need an active Azure subscription that you can create resources in. If the
portal says the subscription is unavailable, resolve that before continuing.

### 1. Create the storage account

1. Sign in to the [Azure portal](https://portal.azure.com).
2. Select **Create a resource** > **Storage account**.
3. Choose your subscription and create or select a resource group, for example `rg-playwright-artifacts`.
4. Enter a globally unique storage account name, for example `pwartifactstest123456`.
5. Select a region near the computer that runs the tests, such as **Central India**.
6. Keep **Standard** performance and **Locally-redundant storage (LRS)** unless you require a different redundancy option.
7. In **Advanced**, keep **Allow Blob anonymous access** disabled.
8. Select **Review + create**, then **Create**.

### 2. Create the private Blob container

1. Open the new storage account in the portal.
2. Select **Data storage** > **Containers**.
3. Select **+ Container**.
4. Set the name to `playwright-artifacts`.
5. Set **Anonymous access level** to **Private (no anonymous access)**.
6. Select **Create**.

### 3. Copy the connection string

1. In the storage account, select **Security + networking** > **Access keys**.
2. Select **Show** for `key1` and copy its **Connection string**.
3. Do not add this value to source code, the repository, or a `.env` file that is committed. It grants broad access to the storage account.

## Run tests and upload automatically

In the PowerShell window where you will run the test, set the connection string.
This lasts only for the current window:

```powershell
$env:AZURE_STORAGE_CONNECTION_STRING = "<paste-the-connection-string-from-the-portal>"
$env:AZURE_STORAGE_CONTAINER = "playwright-artifacts" # optional; this is the default
```

Run the EventHub test with a visible browser:

```powershell
npm run test:eventhub -- --headed
```

Or run the complete suite:

```powershell
npm test
```

The test wrapper runs Playwright, then uploads files changed by that exact run.
It uploads artifacts even when the test fails, so failure screenshots and reports
are retained. It preserves the test result after a successful upload. If an upload
fails, the command exits with code `1` so a CI job cannot silently lose artifacts.

No Azure CLI sign-in or Azure CLI installation is required for uploads.

## Verify an upload manually

1. In the Azure portal, open the storage account.
2. Select **Data storage** > **Containers** > `playwright-artifacts`.
3. Open **runs** and select the timestamped run folder printed by the test command.
4. Confirm that it contains `screenshots`, `report`, and (when the test failed) `test-results`.

To view an HTML report locally later, download that run's `report` folder from the
portal and run:

```powershell
npx playwright show-report "<downloaded-report-folder>"
```

## Troubleshooting

- **`AZURE_STORAGE_CONNECTION_STRING is required`**: set the environment variable in the same PowerShell window, then rerun the test.
- **HTTP 403**: recopy the connection string from **Access keys**, and ensure the storage account allows Shared Key access. Use a fresh terminal variable after rotating an access key.
- **HTTP 404 container not found**: create the `playwright-artifacts` container manually, or set `AZURE_STORAGE_CONTAINER` to the name you created.
- **Subscription not found in the portal**: use a different active subscription or ask the subscription administrator for access; the storage account must exist before automatic uploads can work.

## References

- [Azure Storage connection strings](https://learn.microsoft.com/en-us/azure/storage/storage-configure-connection-string)
- [Upload a blob with JavaScript](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-upload-javascript)
