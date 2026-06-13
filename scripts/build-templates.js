#!/usr/bin/env node
// Bundles the canonical .agent/ content into templates/agent/ so it ships
// inside the published npm tarball (npx only downloads files listed in
// package.json "files"). Local config.json files are never copied.
import { cpSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, '.agent');
const dest = join(root, 'templates', 'agent');

if (!existsSync(src)) {
  console.error('✖ Source .agent/ not found at', src);
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dirname(dest), { recursive: true });

cpSync(src, dest, {
  recursive: true,
  filter: (path) => {
    // Never bundle local/secret config — only the *.template stays.
    const base = path.replace(/\\/g, '/');
    if (base.endsWith('/config.json')) return false;
    return true;
  },
});

console.log('✔ Templates built →', dest);
