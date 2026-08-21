import { access, readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const target = join(root, 'services/target-service');
const failures = [];

async function requirePath(path) {
  try {
    await access(path);
  } catch {
    failures.push(`Missing ${path}`);
  }
}

const largeEntries = await readdir(join(target, 'large-directory'));
const searchEntries = await readdir(join(target, 'search-fixtures'));
const optionalEntries = await readdir(join(target, 'optional-noise'));
const tests = await readdir(join(target, 'test'));
const oversized = await stat(join(target, 'docs/oversize-reference.md'));
const truth = JSON.parse(await readFile(join(root, 'GROUND_TRUTH.json'), 'utf8'));

if (largeEntries.length <= 50) failures.push(`Expected >50 large-directory entries, found ${largeEntries.length}`);
if (searchEntries.length <= 20) failures.push(`Expected >20 search matches, found ${searchEntries.length}`);
if (optionalEntries.length < 10) failures.push(`Expected optional-noise trap, found ${optionalEntries.length}`);
if (tests.length !== 2) failures.push(`Expected exactly 2 mandatory tests, found ${tests.length}`);
if (oversized.size <= 64 * 1024) failures.push(`Oversized file is only ${oversized.size} bytes`);
if (truth.targetPath !== 'services/target-service') failures.push('Ground truth target path changed');

await Promise.all([
  requirePath(join(root, 'service-catalog.json')),
  requirePath(join(target, 'openapi/current.yaml')),
  requirePath(join(target, 'openapi/deprecated-generated.yaml')),
  requirePath(join(root, 'services/sibling-service/docs/PIR-HOT-999999.md')),
]);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'ok',
  largeDirectoryEntries: largeEntries.length,
  searchMatches: searchEntries.length,
  optionalDocuments: optionalEntries.length,
  mandatoryTests: tests.length,
  oversizedBytes: oversized.size,
}, null, 2));
