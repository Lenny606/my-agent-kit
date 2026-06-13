import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { templatesRoot } from '../lib/paths.js';
import pc from '../lib/colors.js';

export async function search(query) {
  if (!query || query.trim() === '') {
    console.error(pc.red('Error: Please provide a search query.'));
    process.exitCode = 1;
    return;
  }

  const root = templatesRoot();
  const scriptPath = join(root, 'scripts', 'skill_search.py');

  if (!existsSync(scriptPath)) {
    console.error(pc.red(`Error: Search script not found at ${scriptPath}`));
    process.exitCode = 1;
    return;
  }

  return new Promise((resolve) => {
    const proc = spawn('python3', [scriptPath, 'search', query], {
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        process.exitCode = code;
      }
      resolve();
    });

    proc.on('error', (err) => {
      console.error(pc.red(`Error executing python3: ${err.message}`));
      console.error(pc.yellow('Make sure Python 3 is installed and available in your PATH.'));
      process.exitCode = 1;
      resolve();
    });
  });
}
