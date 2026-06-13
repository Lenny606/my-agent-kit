import { join } from 'node:path';
import { templatesRoot } from '../lib/paths.js';
import { listItems, readMeta, readDependencies } from '../lib/fsutil.js';
import { SECTIONS } from '../lib/targets.js';

export function list() {
  const root = templatesRoot();

  for (const section of SECTIONS) {
    const dir = join(root, section);
    const items = listItems(dir);
    if (!items.length) continue;

    console.log(`\n${section} (${items.length})`);
    console.log('─'.repeat(40));
    for (const item of items) {
      // Skills are folders with SKILL.md; agents/workflows are flat .md files.
      const mdPath = item.isDir ? join(dir, item.file, 'SKILL.md') : join(dir, item.file);
      const meta = readMeta(mdPath);
      const flag = readDependencies(mdPath) ? ' ⚠' : '';
      const desc = meta.description ? ` — ${truncate(meta.description, 68)}` : '';
      console.log(`  ${item.name}${flag}${desc}`);
    }
  }
  console.log('');
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
