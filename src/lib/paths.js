import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

// Resolves the bundled kit content. In a published package it lives in
// templates/agent/. When running straight from the repo (e.g. node bin/cli.js
// before a build) we fall back to the canonical .agent/ source.
export function templatesRoot() {
  const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const bundled = join(pkgRoot, 'templates', 'agent');
  if (existsSync(bundled)) return bundled;
  const source = join(pkgRoot, '.agent');
  if (existsSync(source)) return source;
  throw new Error('Kit content not found. Run "npm run build:templates" first.');
}
