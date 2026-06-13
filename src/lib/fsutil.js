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

// Reads `name`/`description`/`version` from a SKILL.md / agent .md frontmatter block.
export function readMeta(mdPath) {
  if (!existsSync(mdPath)) return {};
  const text = readFileSync(mdPath, 'utf8');
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(name|description|version):\s*(.+)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return meta;
}

// The metadata file that carries an item's frontmatter for a given section.
// Skills are folders with a SKILL.md; everything else is a flat .md file.
export function metaFileFor(section, entryPath) {
  return section === 'skills' ? join(entryPath, 'SKILL.md') : entryPath;
}

// Declared semantic version of an installable item, or '0.0.0' when unversioned.
export function readVersion(section, entryPath) {
  return readMeta(metaFileFor(section, entryPath)).version || '0.0.0';
}

// Content fingerprint of an installed/source entry, used to detect whether the
// upstream content changed and whether the user edited their local copy.
// Mirrors copyEntry's filter: config.json (per-project) and *.bak are ignored,
// so a backup or a local config never registers as a content change.
export function hashEntry(path) {
  if (!existsSync(path)) return null;
  const hash = createHash('sha256');
  for (const file of walkFiles(path)) {
    hash.update(relative(path, file).replace(/\\/g, '/'));
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function walkFiles(path) {
  const st = statSync(path);
  if (st.isFile()) return [path];
  const out = [];
  for (const name of readdirSync(path).sort()) {
    if (name === 'config.json' || name.endsWith('.bak')) continue;
    const full = join(path, name);
    if (statSync(full).isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

// Reads the kit lockfile (installed item versions + content hashes). Returns a
// normalized shape even when the file is absent or corrupt, so callers can
// treat "no lockfile" as "nothing tracked yet".
export function readLock(lockPath) {
  if (!existsSync(lockPath)) return { items: {} };
  try {
    const data = JSON.parse(readFileSync(lockPath, 'utf8'));
    return { items: {}, ...data };
  } catch {
    return { items: {} };
  }
}

export function writeLock(lockPath, data) {
  writeFileSync(lockPath, JSON.stringify(data, null, 2) + '\n');
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
