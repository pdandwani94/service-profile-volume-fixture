import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURE_FLAGS, FEATURE_FLAG_DEFAULTS } from '../services/target-service/src/feature-flags/flag-catalog.mjs';
import { LOG_EVENTS } from '../services/target-service/src/observability/log-event-catalog.mjs';
import { METRIC_NAMES } from '../services/target-service/src/observability/metric-catalog.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const truth = JSON.parse(await readFile(join(root, 'GROUND_TRUTH.json'), 'utf8'));
const failures = [];

async function sourceText(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const chunks = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) chunks.push(await sourceText(path));
    else chunks.push(await readFile(path, 'utf8'));
  }
  return chunks.join('\n');
}

function compareCatalog(entries, catalog, identifierField, defaultCatalog) {
  const expected = Object.fromEntries(entries.map((entry) => [entry.symbol, entry[identifierField]]));
  if (JSON.stringify(expected) !== JSON.stringify(catalog)) {
    failures.push(`${identifierField} catalog does not match GROUND_TRUTH.json`);
  }

  for (const entry of entries) {
    if (defaultCatalog && defaultCatalog[entry[identifierField]] !== entry.default) {
      failures.push(`Default does not match for ${entry[identifierField]}`);
    }
  }
}

async function checkUsage(entries, catalogName) {
  for (const entry of entries) {
    if (!entry.usagePath.startsWith(`${truth.targetPath}/src/`)) {
      failures.push(`${entry.symbol} usage is outside target production source: ${entry.usagePath}`);
      continue;
    }
    const usage = await readFile(join(root, entry.usagePath), 'utf8');
    if (!usage.includes(`${catalogName}.${entry.symbol}`)) {
      failures.push(`${entry.symbol} is catalogued but not used at ${entry.usagePath}`);
    }
  }
}

compareCatalog(truth.codeSignals.featureFlags, FEATURE_FLAGS, 'key', FEATURE_FLAG_DEFAULTS);
compareCatalog(truth.codeSignals.metrics, METRIC_NAMES, 'name');
compareCatalog(truth.codeSignals.logEvents, LOG_EVENTS, 'event');

await checkUsage(truth.codeSignals.featureFlags, 'FEATURE_FLAGS');
await checkUsage(truth.codeSignals.metrics, 'METRIC_NAMES');
await checkUsage(truth.codeSignals.logEvents, 'LOG_EVENTS');

const targetPackage = JSON.parse(await readFile(join(root, 'services/target-service/package.json'), 'utf8'));
for (const provider of [
  truth.codeSignals.featureFlagProvider,
  truth.codeSignals.metricProvider,
  truth.codeSignals.loggingProvider,
]) {
  if (!targetPackage.dependencies?.[provider.package]) {
    failures.push(`Provider package is missing from target dependencies: ${provider.package}`);
  }
  if (!provider.adapterPath.startsWith(`${truth.targetPath}/src/`)) {
    failures.push(`Provider adapter is outside target production source: ${provider.adapterPath}`);
  }
  try {
    await readFile(join(root, provider.adapterPath), 'utf8');
  } catch {
    failures.push(`Provider adapter is missing: ${provider.adapterPath}`);
  }
}

const targetSource = await sourceText(join(root, truth.targetPath, 'src'));
const siblingSource = await sourceText(join(root, 'services/sibling-service/src'));
for (const signal of truth.forbiddenCodeSignals) {
  if (targetSource.includes(signal)) failures.push(`Sibling signal contaminated target source: ${signal}`);
  if (!siblingSource.includes(signal)) failures.push(`Sibling signal fixture is missing: ${signal}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'ok',
  featureFlags: truth.codeSignals.featureFlags.length,
  metrics: truth.codeSignals.metrics.length,
  logEvents: truth.codeSignals.logEvents.length,
  forbiddenSiblingSignals: truth.forbiddenCodeSignals.length,
}, null, 2));
