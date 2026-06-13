import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import pc from '../lib/colors.js';
import { templatesRoot, kitVersion, LOCKFILE } from '../lib/paths.js';
import { listItems, copyEntry, readLock, writeLock, readVersion, hashEntry } from '../lib/fsutil.js';
import { resolveTarget, SECTIONS } from '../lib/targets.js';
import { resolveConflict } from '../lib/prompt.js';

// Refreshes already-installed kit content from the bundled (npm) source.
// The npm package is the central source of truth: `npx agent-kit@latest update`
// pulls whatever the newest release ships. Local edits are detected via the
// lockfile hash and never silently overwritten.
export async function update(opts) {
  const root = templatesRoot();
  const target = resolveTarget(opts.target);
  const projectDir = resolve(opts.dir || process.cwd());
  const baseDir = join(projectDir, target.base);
  const lockPath = join(baseDir, LOCKFILE);

  if (!existsSync(baseDir)) {
    console.log(pc.yellow(`No "${target.base}" directory in ${projectDir}. Run "agent-kit init" first.`));
    return;
  }

  const lock = readLock(lockPath);
  const selection = parseSelection(opts);
  const plan = buildPlan({ root, target, baseDir, lock, selection });

  const current = plan.filter((p) => p.status === 'current');
  const updates = plan.filter((p) => p.status === 'update');
  const conflicts = plan.filter((p) => p.status === 'conflict');

  if (!updates.length && !conflicts.length) {
    console.log(pc.green(`✔ Everything is up to date (${current.length} item(s) checked).`));
    return;
  }

  console.log(`\n${pc.bold('agent-kit update')} → ${pc.cyan(target.base)} in ${pc.dim(projectDir)}`);
  for (const p of updates) console.log(`  ${pc.green('↑')} ${p.key}  ${versionArrow(p)}`);
  for (const p of conflicts) {
    console.log(`  ${pc.yellow('!')} ${p.key}  ${versionArrow(p)} ${pc.yellow(p.lockHash ? '(local edits)' : '(no baseline)')}`);
  }

  if (opts.check) {
    console.log(pc.dim(`\nDry run. ${updates.length} update(s), ${conflicts.length} need review. Re-run without --check to apply.`));
    return;
  }

  let applied = 0;
  let kept = 0;

  // Safe updates: upstream changed and the local copy is untouched.
  for (const p of updates) {
    copyEntry(p.src, p.dest, { overwrite: true, backup: false });
    lock.items[p.key] = { version: p.srcVersion, hash: p.srcHash };
    applied++;
  }

  // Conflicts: the user edited their copy (or there's no baseline to compare).
  for (const p of conflicts) {
    let overwrite = opts.force;
    let backup = false;
    if (!opts.force) {
      const choice = opts.yes ? 'skip' : await resolveConflict(p.key);
      if (choice === 'overwrite') overwrite = true;
      else if (choice === 'backup') { overwrite = true; backup = true; }
    }
    if (!overwrite) { kept++; continue; }
    copyEntry(p.src, p.dest, { overwrite: true, backup });
    lock.items[p.key] = { version: p.srcVersion, hash: p.srcHash };
    applied++;
  }

  lock.kitVersion = kitVersion();
  lock.target = target.base;
  lock.generatedAt = new Date().toISOString();
  writeLock(lockPath, lock);

  console.log(`\n${pc.green('✔')} Updated ${applied} item(s)` + (kept ? pc.dim(`, ${kept} kept`) : '') + '.');
}

// Compares every installed item against the bundled source and classifies it:
//   current  — installed content already equals source (nothing to do)
//   update   — source differs and the local copy matches the lock baseline (safe)
//   conflict — source differs and the local copy was edited (or no baseline)
function buildPlan({ root, target, baseDir, lock, selection }) {
  lock.items ||= {};
  const plan = [];

  for (const section of SECTIONS) {
    const destSub = target.map[section];
    if (!destSub) continue;
    const srcDir = join(root, section);
    if (!existsSync(srcDir)) continue;

    const all = listItems(srcDir);
    const wanted =
      selection[section] === 'all' ? all : all.filter((i) => selection[section]?.includes(i.name));

    for (const item of wanted) {
      const dest = join(baseDir, destSub, item.file);
      if (!existsSync(dest)) continue; // update only touches what's installed
      const src = join(srcDir, item.file);
      const key = `${section}/${item.name}`;
      const entry = lock.items[key] || {};

      const srcHash = hashEntry(src);
      const destHash = hashEntry(dest);
      const lockHash = entry.hash || null;

      let status;
      if (srcHash === destHash) status = 'current';
      else if (lockHash && destHash === lockHash) status = 'update';
      else status = 'conflict';

      plan.push({
        key, src, dest, status, srcHash, lockHash,
        srcVersion: readVersion(section, src),
        lockVersion: entry.version || readVersion(section, dest),
      });
    }
  }
  return plan;
}

function versionArrow(p) {
  return p.lockVersion === p.srcVersion
    ? pc.dim(`(${p.srcVersion})`)
    : `${pc.dim(p.lockVersion)} → ${pc.bold(p.srcVersion)}`;
}

// Mirrors init's selection flags: no --skills/--agents/... means "all installed".
function parseSelection(opts) {
  const explicit = SECTIONS.some((s) => opts[s]);
  const sel = {};
  for (const section of SECTIONS) {
    if (opts.all || !explicit) sel[section] = 'all';
    else if (opts[section]) sel[section] = String(opts[section]).split(',').map((s) => s.trim()).filter(Boolean);
    else sel[section] = [];
  }
  return sel;
}
