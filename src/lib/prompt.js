import { createInterface } from 'node:readline';

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a); }));
}

export async function confirm(message, def = true) {
  if (!process.stdin.isTTY) return def;
  const hint = def ? 'Y/n' : 'y/N';
  const a = (await ask(`${message} (${hint}) `)).trim().toLowerCase();
  if (!a) return def;
  return a === 'y' || a === 'yes';
}

// Asks how to resolve an existing file. Returns 'overwrite' | 'skip' | 'backup'.
export async function resolveConflict(name) {
  if (!process.stdin.isTTY) return 'skip';
  const a = (await ask(`  ⚠ "${name}" exists — [o]verwrite / [s]kip / [b]ackup? `))
    .trim()
    .toLowerCase();
  if (a === 'o') return 'overwrite';
  if (a === 'b') return 'backup';
  return 'skip';
}
