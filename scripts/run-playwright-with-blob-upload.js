// #!/usr/bin/env node

// // Uses an Azure Storage connection string supplied at runtime; no secret is kept here.
// const { spawn } = require('node:child_process');
// const { createHmac } = require('node:crypto');
// const { mkdir, readFile, readdir, stat } = require('node:fs/promises');
// const path = require('node:path');

// const projectRoot = path.resolve(__dirname, '..');
// const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
// const container = process.env.AZURE_STORAGE_CONTAINER || 'playwright-artifacts';
// const runStartedAt = Date.now();
// const runId = `${new Date(runStartedAt).toISOString().replace(/[-:.]/g, '')}-${process.pid}`;
// const artifactFolders = [
//   { directory: 'screenshots', blobDirectory: 'screenshots' },
//   { directory: 'playwright-report', blobDirectory: 'report' },
//   { directory: 'test-results', blobDirectory: 'test-results' },
// ];

// function run(command, args) {
//   return new Promise((resolve, reject) => {
//     const child = spawn(command, args, { cwd: projectRoot, stdio: 'inherit', shell: false });
//     child.once('error', reject);
//     child.once('close', (code) => resolve(code ?? 1));
//   });
// }

// function parseConnectionString(value) {
//   const settings = Object.fromEntries(
//     value.split(';').filter(Boolean).map((part) => {
//       const separator = part.indexOf('=');
//       return [part.slice(0, separator), part.slice(separator + 1)];
//     }),
//   );

//   if (!settings.AccountName || !settings.AccountKey) {
//     throw new Error('AZURE_STORAGE_CONNECTION_STRING must contain AccountName and AccountKey.');
//   }

//   return {
//     accountName: settings.AccountName,
//     accountKey: settings.AccountKey,
//     blobEndpoint: settings.BlobEndpoint || `${settings.DefaultEndpointsProtocol || 'https'}://${settings.AccountName}.blob.core.windows.net`,
//   };
// }

// const storage = connectionString ? parseConnectionString(connectionString) : undefined;

// function contentTypeFor(file) {
//   const extension = path.extname(file).toLowerCase();
//   return ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.zip': 'application/zip' })[extension] || 'application/octet-stream';
// }

// async function uploadFile(blobName, file) {
//   const contents = await readFile(file);
//   const contentType = contentTypeFor(file);
//   const requestDate = new Date().toUTCString();
//   const serviceVersion = '2023-11-03';
//   const encodedBlobName = blobName.split('/').map(encodeURIComponent).join('/');
//   const canonicalizedHeaders = [
//     'x-ms-blob-type:BlockBlob',
//     `x-ms-date:${requestDate}`,
//     `x-ms-version:${serviceVersion}`,
//   ].join('\n') + '\n';
//   const canonicalizedResource = `/${storage.accountName}/${encodeURIComponent(container)}/${encodedBlobName}`;
//   const stringToSign = [
//     'PUT', '', '', String(contents.length), '', contentType, '', '', '', '', '', '',
//   ].join('\n') + `\n${canonicalizedHeaders}${canonicalizedResource}`;
//   const signature = createHmac('sha256', Buffer.from(storage.accountKey, 'base64'))
//     .update(stringToSign, 'utf8')
//     .digest('base64');
//   const endpoint = storage.blobEndpoint.replace(/\/+$/, '');
//   const response = await fetch(`${endpoint}/${encodeURIComponent(container)}/${encodedBlobName}`, {
//     method: 'PUT',
//     headers: {
//       Authorization: `SharedKey ${storage.accountName}:${signature}`,
//       'Content-Length': String(contents.length),
//       'Content-Type': contentType,
//       'x-ms-blob-type': 'BlockBlob',
//       'x-ms-date': requestDate,
//       'x-ms-version': serviceVersion,
//     },
//     body: contents,
//   });

//   if (!response.ok) {
//     const details = (await response.text()).slice(0, 500);
//     throw new Error(`Azure Blob upload failed for ${path.relative(projectRoot, file)} (${response.status} ${response.statusText}): ${details}`);
//   }
// }

// async function filesChangedSince(directory) {
//   const files = [];
//   async function visit(currentDirectory) {
//     let entries;
//     try {
//       entries = await readdir(currentDirectory, { withFileTypes: true });
//     } catch (error) {
//       if (error.code === 'ENOENT') return;
//       throw error;
//     }
//     for (const entry of entries) {
//       const fullPath = path.join(currentDirectory, entry.name);
//       if (entry.isDirectory()) await visit(fullPath);
//       else if (entry.isFile() && (await stat(fullPath)).mtimeMs >= runStartedAt) files.push(fullPath);
//     }
//   }
//   await visit(directory);
//   return files;
// }

// async function uploadArtifacts() {
//   for (const artifact of artifactFolders) {
//     const sourceDirectory = path.join(projectRoot, artifact.directory);
//     const files = await filesChangedSince(sourceDirectory);
//     if (files.length === 0) {
//       console.log(`No new files in ${artifact.directory}; skipping.`);
//       continue;
//     }
//     for (const file of files) {
//       const relativePath = path.relative(sourceDirectory, file).split(path.sep).join('/');
//       const blobName = `runs/${runId}/${artifact.blobDirectory}/${relativePath}`;
//       await uploadFile(blobName, file);
//     }
//     console.log(`Uploaded ${files.length} ${artifact.directory} file(s).`);
//   }
//   console.log(`Azure Blob run: ${container}/runs/${runId}/`);
// }

// async function main() {
//   if (process.argv.includes('--help') || process.argv.includes('-h')) {
//     console.log('Usage: npm test -- [Playwright arguments]');
//     console.log('Required: AZURE_STORAGE_CONNECTION_STRING. Optional: AZURE_STORAGE_CONTAINER (default: playwright-artifacts).');
//     return;
//   }
//   if (!storage) {
//     throw new Error('AZURE_STORAGE_CONNECTION_STRING is required. Copy it from the storage account Access keys page and set it in this terminal before running the test.');
//   }
//   await mkdir(path.join(projectRoot, 'screenshots'), { recursive: true });
//   // Launch Playwright's JavaScript CLI directly. This avoids spawning the
//   // Windows npx.cmd shim, which can fail with EINVAL under Node on Windows.
//   const playwrightCli = require.resolve('@playwright/test/cli');
//   const testExitCode = await run(process.execPath, [playwrightCli, 'test', ...process.argv.slice(2)]);
//   try {
//     await uploadArtifacts();
//   } catch (error) {
//     console.error(error.message);
//     process.exitCode = 1;
//     return;
//   }
//   process.exitCode = testExitCode;
// }

// main().catch((error) => {
//   console.error(error.message);
//   process.exitCode = 1;
// });
