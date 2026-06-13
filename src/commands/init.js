import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import pc from '../lib/colors.js';
import { templatesRoot } from '../lib/paths.js';
import { listItems, ensureDir, copyEntry } from '../lib/fsutil.js';
import { resolveTarget, SECTIONS } from '../lib/targets.js';
import { confirm, resolveConflict } from '../lib/prompt.js';

export async function init(opts) {
  const root = templatesRoot();
  const target = resolveTarget(opts.target);
  const projectDir = resolve(opts.dir || process.cwd());
  const baseDir = join(projectDir, target.base);

  // Build the work plan: which sections/items get installed where.
  const selection = parseSelection(opts);
  const plan = [];
  let skippedSections = [];

  for (const section of SECTIONS) {
    const destSub = target.map[section];
    if (!destSub) {
      skippedSections.push(section);
      continue;
    }
    const srcDir = join(root, section);
    if (!existsSync(srcDir)) continue;

    const all = listItems(srcDir);
    const wanted =
      selection[section] === 'all'
        ? all
        : all.filter((item) => selection[section]?.includes(item.name));

    for (const item of wanted) {
      plan.push({
        section,
        name: item.name,
        src: join(srcDir, item.file),
        dest: join(baseDir, destSub, item.file),
      });
    }
  }

  if (!plan.length) {
    console.log(pc.yellow('Nothing selected to install.'));
    return;
  }

  // Summary + confirmation
  console.log(`\n${pc.bold('Agent Kit')} → ${pc.cyan(target.base)} in ${pc.dim(projectDir)}`);
  for (const section of SECTIONS) {
    const count = plan.filter((p) => p.section === section).length;
    if (count) console.log(`  ${pc.green('+')} ${count} ${section}`);
  }
  if (skippedSections.length) {
    console.log(pc.yellow(`  (target "${opts.target}" does not support: ${skippedSections.join(', ')})`));
  }

  if (!opts.yes && !(await confirm('\nProceed?', true))) {
    console.log('Aborted.');
    return;
  }

  // Execute
  let copied = 0;
  let skipped = 0;
  for (const item of plan) {
    ensureDir(join(item.dest, '..'));
    let overwrite = opts.force;
    let backup = false;

    if (existsSync(item.dest) && !opts.force) {
      const choice = opts.yes ? 'skip' : await resolveConflict(`${item.section}/${item.name}`);
      if (choice === 'overwrite') overwrite = true;
      else if (choice === 'backup') { overwrite = true; backup = true; }
    }

    const res = copyEntry(item.src, item.dest, { overwrite, backup });
    if (res === 'copied') copied++;
    else skipped++;
  }

  console.log(`\n${pc.green('✔')} Installed ${copied} item(s)` + (skipped ? pc.dim(`, ${skipped} skipped`) : '') + '.');
  console.log(pc.dim(`  Location: ${baseDir}`));
}

// --skills / --agents / --workflows accept comma lists or "all".
// With no selection flags at all, everything is installed.
function parseSelection(opts) {
  const explicit = ['skills', 'agents', 'workflows', 'rules', 'scripts'].some((s) => opts[s]);
  const sel = {};
  for (const section of SECTIONS) {
    if (opts.all || !explicit) {
      sel[section] = 'all';
    } else if (opts[section]) {
      sel[section] = String(opts[section]).split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      sel[section] = [];
    }
  }
  return sel;
}
