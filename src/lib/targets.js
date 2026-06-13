// Maps the canonical .agent/ layout onto the directory convention of each
// supported target tool. `null` means the section is unsupported for that
// target and will be skipped with a warning.
export const TARGETS = {
  agent: {
    base: '.agent',
    map: {
      skills: 'skills',
      agents: 'agents',
      workflows: 'workflows',
      rules: 'rules',
      scripts: 'scripts',
    },
  },
  claude: {
    base: '.claude',
    map: {
      skills: 'skills',
      agents: 'agents',
      workflows: 'commands',
      rules: 'rules',
      scripts: 'scripts',
    },
  },
  cursor: {
    base: '.cursor',
    map: {
      skills: 'rules',
      agents: null,
      workflows: null,
      rules: 'rules',
      scripts: null,
    },
  },
  junie: {
    base: '.junie',
    map: {
      skills: 'skills',
      agents: 'agents',
      workflows: 'workflows',
      rules: 'guidelines',
      scripts: 'scripts',
    },
  },
};

export const SECTIONS = ['skills', 'agents', 'workflows', 'rules', 'scripts'];

export function resolveTarget(name) {
  const t = TARGETS[name];
  if (!t) {
    throw new Error(
      `Unknown target "${name}". Valid targets: ${Object.keys(TARGETS).join(', ')}`
    );
  }
  return t;
}
