import { readdirSync, statSync, existsSync, mkdirSync, cpSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
