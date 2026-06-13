import { readdirSync, statSync, existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

export function listDirs(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((name) => statSync(join(path, name)).isDirectory())
    .sort();
}

// Lists installable items in a section. Skills live in subfolders; agents,
// workflows, rules and scripts are flat files. Returns { name, file, isDir }
// where `name` is the slug (without extension) used for --filter matching and
// `file` is the actual on-disk entry name to copy.
export function listItems(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((file) => !file.startsWith('.'))
    .map((file) => {
      const isDir = statSync(join(path, file)).isDirectory();
      const name = isDir ? file : file.replace(/\.[^.]+$/, '');
      return { name, file, isDir };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

// Copies a single entry (file or directory) from src to dest.
// Returns 'copied' | 'skipped' depending on conflict handling.
export function copyEntry(src, dest, { overwrite, backup }) {
  if (existsSync(dest)) {
    if (backup) cpSync(dest, dest + '.bak', { recursive: true });
    if (!overwrite) return 'skipped';
  }
  cpSync(src, dest, {
    recursive: true,
    filter: (p) => !p.replace(/\\/g, '/').endsWith('/config.json'),
  });
  return 'copied';
}

// Reads `name`/`description` from a SKILL.md / agent .md frontmatter block.
export function readMeta(mdPath) {
  if (!existsSync(mdPath)) return {};
  const text = readFileSync(mdPath, 'utf8');
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(name|description):\s*(.+)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return meta;
}

// Parses the optional `dependencies:` block from a SKILL.md frontmatter.
// Returns null when absent, otherwise { python, node, system, mcp, install, note }.
// `mcp` lists Model Context Protocol servers the skill expects to be available
// (configured in mcp_config.json) — distinct from packages you `install`.
// Schema (YAML-ish, intentionally minimal — no YAML lib needed):
//   dependencies:
//     python: [playwright]
//     system: [chromium]
//     mcp: [playwright]
//     install: pip install playwright && playwright install chromium
//     note: ...
export function readDependencies(mdPath) {
  if (!existsSync(mdPath)) return null;
  const text = readFileSync(mdPath, 'utf8');
  const fm = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fm) return null;

  const lines = fm[1].split('\n');
  const start = lines.findIndex((l) => /^dependencies:\s*$/.test(l));
  if (start === -1) return null;

  const deps = {};
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\s+\S/.test(line)) break; // dedent → end of block
    const kv = line.match(/^\s+(python|node|system|mcp|install|note):\s*(.*)$/);
    if (!kv) continue;
    const [, key, raw] = kv;
    if (key === 'install' || key === 'note') {
      deps[key] = raw.trim();
    } else {
      const arr = raw.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean);
      if (arr.length) deps[key] = arr;
    }
  }
  return Object.keys(deps).length ? deps : null;
}
