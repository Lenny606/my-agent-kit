import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

// Name of the lockfile written inside the target base dir (e.g. .agent/).
export const LOCKFILE = 'agent-kit.lock.json';

function pkgRoot() {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

// Version of the installed agent-kit package, recorded into the lockfile so an
// `update` run can show which kit release produced the current install.
export function kitVersion() {
  try {
    return JSON.parse(readFileSync(join(pkgRoot(), 'package.json'), 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// Resolves the bundled kit content. In a published package it lives in
// templates/agent/. When running straight from the repo (e.g. node bin/cli.js
// before a build) we fall back to the canonical .agent/ source.
export function templatesRoot() {
  const root = pkgRoot();
  const bundled = join(root, 'templates', 'agent');
  if (existsSync(bundled)) return bundled;
  const source = join(root, '.agent');
  if (existsSync(source)) return source;
  throw new Error('Kit content not found. Run "npm run build:templates" first.');
}
