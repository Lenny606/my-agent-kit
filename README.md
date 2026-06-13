# agent-kit

> Install AI agent **skills**, **agents** and **workflows** into your project with a single command.

A modular toolkit (40 skills, 20 specialist agents, 11 workflows) that you can scaffold into any project via `npx`. Works with the Antigravity (`.agent/`), Claude Code (`.claude/`) and Cursor (`.cursor/`) layouts.

## Quick start

```bash
# Install the whole kit into the current project (.agent/ by default)
npx agent-kit init

# Pick a target layout
npx agent-kit init --target claude
npx agent-kit init --target cursor

# Install only specific skills
npx agent-kit init --skills webapp-testing,api-patterns

# See what's available
npx agent-kit list
```

No global install required — `npx` fetches and runs it on demand. The CLI has **zero runtime dependencies**.

## Commands

### `init`

Copies kit content into your project.

| Option | Description |
| ------ | ----------- |
| `--target <agent\|claude\|cursor>` | Target directory convention (default: `agent`) |
| `--dir <path>` | Project directory (default: current working dir) |
| `--skills <a,b,c>` | Install only these skills |
| `--agents <a,b,c>` | Install only these agents |
| `--workflows <a,b,c>` | Install only these workflows |
| `--all` | Install everything (the default when no filter is given) |
| `--force` | Overwrite existing files without asking |
| `--yes`, `-y` | Non-interactive; skip prompts and existing files |

When a file already exists you'll be asked to **overwrite / skip / backup** (creates a `.bak`). Use `--force` or `--yes` in CI.

### `list`

Prints available skills, agents and workflows with their descriptions (read from the `SKILL.md` / agent frontmatter).

## Target layout mapping

| Kit section | `agent` | `claude` | `cursor` |
| ----------- | ------- | -------- | -------- |
| skills      | `.agent/skills/` | `.claude/skills/` | `.cursor/rules/` |
| agents      | `.agent/agents/` | `.claude/agents/` | — |
| workflows   | `.agent/workflows/` | `.claude/commands/` | — |
| rules       | `.agent/rules/` | `.claude/rules/` | `.cursor/rules/` |
| scripts     | `.agent/scripts/` | `.claude/scripts/` | — |

Sections marked `—` are unsupported for that target and are skipped with a warning.

## Skill dependencies

Some skills ship helper scripts that call external tools, or expect a Model
Context Protocol (MCP) server to be available. Both are declared in the skill's
`SKILL.md` frontmatter so you know what's needed up front:

```yaml
---
name: webapp-testing
dependencies:
  python: [playwright]      # pip packages
  node: [lighthouse]        # global npm CLIs
  system: [chromium]        # system binaries / browsers
  mcp: [playwright]         # MCP servers to configure in mcp_config.json
  install: pip install playwright && playwright install chromium
  note: optional free-text context
---
```

`mcp` lists the MCP servers a skill leverages (e.g. a database skill might need a
`mongodb` server, a browser skill a `playwright` one). Unlike `python`/`node`/`system`,
these aren't installed with a package command — you register them in your agent's
`mcp_config.json` (see `templates/agent/mcp_config.json` for the format).

After `init`, the CLI prints a summary of any external tools and MCP servers the
installed skills need. In `list`, skills with dependencies are marked `⚠`.
The kit never installs or configures these for you — it only tells you what's required.

## Notes

- Local `config.json` files are never bundled; only their `config.json.template` counterparts are.

## Development

The published package bundles the canonical `.agent/` content into `templates/agent/`:

```bash
npm run build:templates   # regenerate templates/ from .agent/
npm pack                  # build a local tarball (runs build automatically)
npx ./agent-kit-0.1.0.tgz init   # test the packaged CLI in a scratch dir
```

`templates/` is generated and git-ignored; it is rebuilt automatically on `prepack` / `prepublishOnly`.

## License

MIT
