import { readFile } from 'node:fs/promises';

const [inputPath] = process.argv.slice(2).filter((argument) => argument !== '--');
if (!inputPath) {
  console.error('Usage: node scripts/validate-code-signals.mjs <agent-output>');
  process.exit(2);
}

const raw = await readFile(inputPath, 'utf8');
const truth = JSON.parse(await readFile(new URL('../GROUND_TRUTH.json', import.meta.url), 'utf8'));
const failures = [];

function extractJsonOnly(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('```json')) {
    if (!trimmed.endsWith('```')) throw new Error('JSON fence is not the final output');
    return trimmed.slice('```json'.length, -3).trim();
  }
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    throw new Error('Output contains prose outside the JSON object');
  }
  return trimmed;
}

let output;
try {
  output = JSON.parse(extractJsonOnly(raw));
} catch (error) {
  console.error(`Invalid JSON-only output: ${error.message}`);
  process.exit(1);
}

function compareEntries(label, actualEntries, expectedEntries, identifierField, metadataFields) {
  if (!Array.isArray(actualEntries)) {
    failures.push(`${label} must be an array`);
    return;
  }

  const actualSet = [...new Set(actualEntries.map((entry) => entry[identifierField]))].sort();
  const expectedSet = [...new Set(expectedEntries.map((entry) => entry[identifierField]))].sort();
  if (JSON.stringify(actualSet) !== JSON.stringify(expectedSet)) {
    failures.push(`${label} mismatch: expected ${JSON.stringify(expectedSet)}, received ${JSON.stringify(actualSet)}`);
  }
  if (actualEntries.length !== expectedEntries.length) {
    failures.push(`${label} must contain exactly ${expectedEntries.length} entries`);
  }
  if (JSON.stringify(actualEntries.map((entry) => entry[identifierField])) !== JSON.stringify(actualSet)) {
    failures.push(`${label} must be sorted lexicographically by ${identifierField}`);
  }

  for (const expected of expectedEntries) {
    const actual = actualEntries.find((entry) => entry[identifierField] === expected[identifierField]);
    if (!actual) continue;
    for (const field of metadataFields) {
      if (actual[field] !== expected[field]) {
        failures.push(`${label} metadata mismatch for ${expected[identifierField]}: ${field}`);
      }
    }
  }
}

if (output.servicePath !== truth.targetPath) failures.push(`Expected servicePath ${truth.targetPath}`);
if (!/^[0-9a-f]{40}$/.test(output.revision ?? '')) failures.push('revision must be an exact 40-character commit SHA');

compareEntries('feature flags', output.featureFlags, truth.codeSignals.featureFlags, 'key', ['default', 'usagePath']);
compareEntries('metrics', output.metrics, truth.codeSignals.metrics, 'name', ['type', 'usagePath']);
compareEntries('log events', output.logEvents, truth.codeSignals.logEvents, 'event', ['level', 'usagePath']);

const serialized = JSON.stringify(output);
for (const signal of truth.forbiddenCodeSignals) {
  if (serialized.includes(signal)) failures.push(`Sibling signal contamination detected: ${signal}`);
}

for (const [providerKey, truthKey] of [
  ['featureFlags', 'featureFlagProvider'],
  ['metrics', 'metricProvider'],
  ['logging', 'loggingProvider'],
]) {
  const actual = output.providers?.[providerKey];
  const expected = truth.codeSignals[truthKey];
  if (actual?.name !== expected.provider || actual?.package !== expected.package
    || actual?.adapterPath !== expected.adapterPath) {
    failures.push(`${providerKey} provider metadata does not match ground truth`);
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'pass',
  revision: output.revision,
  featureFlags: output.featureFlags?.length ?? 0,
  metrics: output.metrics?.length ?? 0,
  logEvents: output.logEvents?.length ?? 0,
}, null, 2));
