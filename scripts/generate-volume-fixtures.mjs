import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const target = join(root, 'services/target-service');

async function writeSeries(directory, count, extension, content) {
  await mkdir(directory, { recursive: true });
  for (let index = 1; index <= count; index += 1) {
    const suffix = String(index).padStart(3, '0');
    await writeFile(join(directory, `entry-${suffix}.${extension}`), content(index));
  }
}

await writeSeries(join(target, 'large-directory'), 60, 'json', (index) =>
  `${JSON.stringify({ generated: true, index, service: 'profile-volume-target' })}\n`,
);

await writeSeries(join(target, 'search-fixtures'), 25, 'md', (index) =>
  `# Search fixture ${index}\n\nprofile-volume-target synthetic search match ${index}. Generated discovery metadata, not implementation evidence.\n`,
);

await writeSeries(join(target, 'optional-noise'), 12, 'md', (index) =>
  `# Optional document ${index}\n\nOptional profile-volume-target enrichment that must not displace mandatory tests.\n`,
);

const heading = '# Oversized reference\n\nThis file is deliberately larger than 64 KiB and must be skipped with a gap.\n';
const oversizedBytes = 65 * 1024;
await writeFile(join(target, 'docs/oversize-reference.md'), heading.padEnd(oversizedBytes, 'x'));

console.log('Generated volume fixtures.');
