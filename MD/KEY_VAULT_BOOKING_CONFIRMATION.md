# Store booking confirmations in Azure Key Vault

When the EventHub Playwright test confirms a booking, this lab stores the
captured confirmation JSON directly in Azure Key Vault. Key Vault creates a
new immutable version each time the same secret name is set: the first test
run creates V1, the next run creates V2, and so on. The test then reads the
latest version back from Key Vault to verify it.

> Use only non-production, non-payment test data for this lab. A Key Vault
> secret is encrypted, but anyone who is allowed to read it can see the full
> booking confirmation.

## 1. Create a Key Vault in Azure Portal

1. Sign in to [Azure Portal](https://portal.azure.com).
2. Select **Create a resource** > **Key Vault**.
3. Select your subscription and create or select a resource group.
4. Enter a globally unique vault name, for example `kv-booking-lab-12345`.
5. Select a region near you, then select **Review + create** > **Create**.
6. After deployment, open the vault and select **Access control (IAM)**.
7. Give your signed-in user both of these roles at the vault scope:
   - **Key Vault Secrets Officer** - creates new secrets and versions.
   - **Key Vault Secrets User** - reads secret values.

Role assignments can take a few minutes to apply. If your vault uses the
legacy **Vault access policy** permission model instead of Azure RBAC, grant
your user the secret permissions **Get**, **Set**, and **List** instead.

## 2. Sign in to Azure CLI

Install the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli-windows)
if it is not already available, then sign in in PowerShell:

```powershell
az login
az account set --subscription "<your-subscription-name-or-id>"
```

## 3. Run the booking test and store the confirmation automatically

Set the Key Vault name in the terminal that runs the test. This only configures
the destination; you do not enter or update booking data in PowerShell.

```powershell
$env:AZURE_KEY_VAULT_NAME = "kv-booking-lab-12345"
$env:AZURE_KEY_VAULT_SECRET_NAME = "booking-confirmation" # optional; this is the default
npm run test:eventhub:keyvault -- --headed
```

After the normal booking confirmation checks pass, the test captures the
reference, customer, quantity, total, and test details. It sends that JSON to
Key Vault using the Azure CLI sign-in token. The confirmation is not written
to a local JSON file and is not supplied on a command line.

The first successful booking test creates `booking-confirmation` V1. Run the
same command again to create V2. Each later run creates one further version.
The Playwright output prints the Key Vault secret ID, including the new version
ID, but never prints the confirmation value.

Use a different secret name when needed:

```powershell
$env:AZURE_KEY_VAULT_SECRET_NAME = "eventhub-booking-confirmation"
npm run test:eventhub:keyvault -- --headed
```

## 4. Verify versions in Azure Portal

1. Open the Key Vault, then select **Objects** > **Secrets**.
2. Select `booking-confirmation` (or the name you supplied).
3. Select **Current Version** to view the latest JSON value.
4. Select an older version from the versions list to confirm that the first
   value is retained.

## Read the latest version again

This command always returns the current/latest version because no version ID is
included:

```powershell
az keyvault secret show `
  --vault-name "kv-booking-lab-12345" `
  --name "booking-confirmation" `
  --query value -o tsv
```

To list versions without exposing their values:

```powershell
az keyvault secret list-versions `
  --vault-name "kv-booking-lab-12345" `
  --name "booking-confirmation" `
  --query "[].{version:id,created:attributes.created,enabled:attributes.enabled}" -o table
```

## Troubleshooting

- **`az` is not recognized**: install Azure CLI, close and reopen PowerShell,
  then run `az login`.
- **HTTP 403 / Forbidden**: confirm the role assignments or access policy are
  on this Key Vault, then wait a few minutes for Azure RBAC propagation.
- **Vault not found**: check the vault name and active subscription with
  `az account show`.
- **Invalid secret name**: use 1-127 letters, digits, or hyphens; do not use
  spaces or underscores.
- **`AZURE_KEY_VAULT_NAME is required`**: set the vault name in the same
  terminal that runs Playwright, then rerun the test.
- **Could not obtain an Azure access token**: run `az login` in the same user
  account that runs the test, then retry.

## References

- [Azure Key Vault secrets overview](https://learn.microsoft.com/azure/key-vault/secrets/about-secrets)
- [Azure CLI: az keyvault secret](https://learn.microsoft.com/cli/azure/keyvault/secret)
