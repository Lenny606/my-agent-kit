#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { init } from '../src/commands/init.js';
import { list } from '../src/commands/list.js';
import { search } from '../src/commands/search.js';

const HELP = `
agent-kit — install AI agent skills, agents & workflows into your project.

Usage:
  npx agent-kit <command> [options]

Commands:
  init        Install kit content into the current project
  list        Show available skills, agents and workflows
  search      Search for skills semantically using a query
  help        Show this help

init options:
  --target <agent|claude|cursor>   Target layout (default: agent)
  --dir <path>                     Project directory (default: cwd)
  --skills <a,b,c>                 Only these skills
  --agents <a,b,c>                 Only these agents
  --workflows <a,b,c>              Only these workflows
  --all                            Install everything (default when no filter)
  --force                          Overwrite existing files without asking
  --yes, -y                        Non-interactive (skip prompts/conflicts)

Examples:
  npx agent-kit init
  npx agent-kit init --target claude
  npx agent-kit init --skills webapp-testing,api-patterns
  npx agent-kit list
  npx agent-kit search "auth password"
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    target: { type: 'string', default: 'agent' },
    dir: { type: 'string' },
    skills: { type: 'string' },
    agents: { type: 'string' },
    workflows: { type: 'string' },
    rules: { type: 'string' },
    scripts: { type: 'string' },
    all: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    yes: { type: 'boolean', short: 'y', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const cmd = positionals[0] || (values.help ? 'help' : 'help');

try {
  switch (cmd) {
    case 'init':
      await init(values);
      break;
    case 'list':
      list();
      break;
    case 'search':
      await search(positionals.slice(1).join(' '));
      break;
    case 'help':
      console.log(HELP);
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      console.log(HELP);
      process.exitCode = 1;
  }
} catch (err) {
  console.error(`\nError: ${err.message}`);
  process.exitCode = 1;
}
