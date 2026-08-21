import { readFile } from 'node:fs/promises';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/validate-profile.mjs <profile-output>');
  process.exit(2);
}

const raw = await readFile(inputPath, 'utf8');
const truth = JSON.parse(await readFile(new URL('../GROUND_TRUTH.json', import.meta.url), 'utf8'));
const failures = [];

function extractJsonOnly(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('```json')) {
    if (!trimmed.endsWith('```')) throw new Error('JSON fence is not the final output');
    const body = trimmed.slice('```json'.length, -3).trim();
    if (body.includes('```')) throw new Error('Multiple fenced blocks found');
    return body;
  }
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    throw new Error('Output contains prose outside the JSON object');
  }
  return trimmed;
}

let profile;
try {
  profile = JSON.parse(extractJsonOnly(raw));
} catch (error) {
  console.error(`Invalid JSON-only output: ${error.message}`);
  process.exit(1);
}

const serialized = JSON.stringify(profile);
const expectedTopLevel = [
  'Identity & classification', 'Repositories', 'Ownership', 'Runtime & local dev',
  'Ingress', 'Egress', 'Graph dependencies', 'Capabilities', 'Related docs',
  'Operations', 'Notes and gaps', 'Metadata', 'Repository profiles',
];

if (JSON.stringify(Object.keys(profile)) !== JSON.stringify(expectedTopLevel)) {
  failures.push('Top-level keys or ordering do not match the service-profile template');
}
if (profile['Identity & classification']?.service_name !== truth.targetService) {
  failures.push(`Expected service_name ${truth.targetService}`);
}
if (profile['Repository profiles']?.length !== 1) failures.push('Expected exactly one repository profile');

const endpoints = profile.Ingress?.http_endpoints ?? [];
if (!endpoints.some((endpoint) => endpoint.method === 'POST' && endpoint.path === '/v1/volume-orders')) {
  failures.push('Missing current endpoint: POST /v1/volume-orders');
}
if (!endpoints.some((endpoint) => endpoint.method === 'GET' && endpoint.path === '/health/ready')) {
  failures.push('Missing current endpoint: GET /health/ready');
}

for (const fact of truth.requiredFacts) {
  if (!serialized.includes(fact)) failures.push(`Missing required fact: ${fact}`);
}
for (const qualifier of truth.requiredQualifiers) {
  if (!serialized.toLowerCase().includes(qualifier.toLowerCase())) failures.push(`Missing qualifier: ${qualifier}`);
}
const targetOnly = structuredClone(profile);
delete targetOnly['Repository profiles'];
delete targetOnly['Notes and gaps'];
if (targetOnly.Metadata) targetOnly.Metadata.sources = [];
const targetRepositoryService = profile['Repository profiles']?.[0]?.services?.find(
  (service) => service.name === truth.targetService,
);
const targetFactPayload = JSON.stringify({ targetOnly, targetRepositoryService });
for (const fact of truth.forbiddenFacts) {
  if (targetFactPayload.includes(fact)) failures.push(`Sibling contamination detected: ${fact}`);
}

const repositoryGaps = profile['Repository profiles']?.[0]?.notes_and_gaps ?? [];
const revisionEntry = repositoryGaps.find((entry) => entry.startsWith('Repository evidence revision:'));
if (!revisionEntry || !/revision=[0-9a-f]{40}; pinning=sha;/.test(revisionEntry)) {
  failures.push('Missing SHA-pinned standardized revision entry');
}

if (revisionEntry?.includes('limitation=none')) {
  const mutableUrls = [...serialized.matchAll(/github\.com[^" ]+\/blob\/main\//g)];
  if (mutableUrls.length) failures.push('SHA-pinned profile uses mutable blob/main URLs with limitation=none');
}

const identityWords = profile['Identity & classification']?.description?.trim().split(/\s+/).length ?? 0;
const repositoryWords = profile['Repository profiles']?.[0]?.repository?.description?.trim().split(/\s+/).length ?? 0;
const serviceWords = profile['Repository profiles']?.[0]?.services?.[0]?.purpose?.trim().split(/\s+/).length ?? 0;
if (identityWords < 250 || identityWords > 350) failures.push(`Identity description word count ${identityWords}, expected 250-350`);
if (repositoryWords < 250 || repositoryWords > 350) failures.push(`Repository description word count ${repositoryWords}, expected 250-350`);
if (serviceWords < 250 || serviceWords > 350) failures.push(`Target service purpose word count ${serviceWords}, expected 250-350`);

if (serialized.includes('"TBD"')) failures.push('TBD placeholder present; use allowed empty values');
if (!serialized.includes('[src:')) failures.push('No inline [src: ...] evidence citations found');
if (repositoryGaps.some((entry) => /test\/(service|http)\.test\.mjs.*not read/i.test(entry))) {
  failures.push('A mandatory test was skipped before optional enrichment');
}
if (!repositoryGaps.some((entry) => /oversize|64 KiB|64KiB/i.test(entry))) {
  failures.push('Oversized-file gap was not recorded');
}
if (!repositoryGaps.some((entry) => /50 directory|directory entr|truncat/i.test(entry))) {
  failures.push('Large-directory truncation gap was not recorded');
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'pass',
  identityWords,
  repositoryWords,
  serviceWords,
  revisionEntry,
}, null, 2));
