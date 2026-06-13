# Antigravity Skills

> **Guide to creating and using Skills in the Antigravity Kit**

---

## 📋 Overview

While Antigravity's base models (like Gemini) are powerful generalists, they don't know your specific project context or your team's standards. Loading every rule or tool into the agent's context window leads to "tool bloat," higher costs, latency, and confusion.

**Antigravity Skills** solve this through **Progressive Disclosure**. A Skill is a package of specialized knowledge that remains dormant until needed. This information is only loaded into the agent's context when your specific request matches the skill's description.

---

## 📁 Structure and Scope

Skills are folder-based packages. You can define these scopes based on your needs:

| Scope         | Path                              | Description                          |
| ------------- | --------------------------------- | ------------------------------------ |
| **Workspace** | `<workspace-root>/.agent/skills/` | Available only in a specific project |

### Skill Directory Structure

```
my-skill/
├── SKILL.md      # (Required) Metadata & instructions
├── scripts/      # (Optional) Python or Bash scripts
├── references/   # (Optional) Text, documentation, templates
└── assets/       # (Optional) Images or logos
```

---

## 🔍 Example 1: Code Review Skill

This is an instruction-only skill; you only need to create the `SKILL.md` file.

### Step 1: Create the directory

```bash
mkdir -p .agent/skills/code-review
```

### Step 2: Create SKILL.md

```markdown
---
name: code-review
description: Reviews code changes for bugs, style issues, and best practices. Use when reviewing PRs or checking code quality.
---

# Code Review Skill

When reviewing code, follow these steps:

## Review checklist

1. **Correctness**: Does the code do what it's supposed to?
2. **Edge cases**: Are error conditions handled?
3. **Style**: Does it follow project conventions?
4. **Performance**: Are there obvious inefficiencies?

## How to provide feedback

- Be specific about what needs to change
- Explain why, not just what
- Suggest alternatives when possible
```

> **Note**: The `SKILL.md` file contains metadata (name, description) at the top, followed by the instructions. The agent will only read the metadata and load the full instructions only when needed.

### Try it out

Create a file `demo_bad_code.py`:

```python
import time

def get_user_data(users, id):
    # Find user by ID
    for u in users:
        if u['id'] == id:
            return u
    return None

def process_payments(items):
    total = 0
    for i in items:
        # Calculate tax
        tax = i['price'] * 0.1
        total = total + i['price'] + tax
        time.sleep(0.1)  # Simulate slow network call
    return total

def run_batch():
    users = [{'id': 1, 'name': 'Alice'}, {'id': 2, 'name': 'Bob'}]
    items = [{'price': 10}, {'price': 20}, {'price': 100}]

    u = get_user_data(users, 3)
    print("User found: " + u['name'])  # Will crash if None

    print("Total: " + str(process_payments(items)))

if __name__ == "__main__":
    run_batch()
```

**Prompt**: `review the @demo_bad_code.py file`

The Agent will automatically identify the `code-review` skill, load the information, and follow the instructions.

---

## 📄 Example 2: License Header Skill

This skill uses a reference file in the `resources/` (or `references/`) directory.

### Step 1: Create the directory

```bash
mkdir -p .agent/skills/license-header-adder/resources
```

### Step 2: Create the template file

**`.agent/skills/license-header-adder/resources/HEADER.txt`**:

```
/*
 * Copyright (c) 2026 YOUR_COMPANY_NAME LLC.
 * All rights reserved.
 * This code is proprietary and confidential.
 */
```

### Step 3: Create SKILL.md

**`.agent/skills/license-header-adder/SKILL.md`**:

```markdown
---
name: license-header-adder
description: Adds the standard corporate license header to new source files.
---

# License Header Adder

This skill ensures that all new source files have the correct copyright header.

## Instructions

1. **Read the Template**: Read the content of `resources/HEADER.txt`.
2. **Apply to File**: When creating a new file, prepend this exact content.
3. **Adapt Syntax**:
   - For C-style languages (Java, TS), keep the `/* */` block.
   - For Python/Shell, convert to `#` comments.
```

### Try it out

**Prompt**: `Create a new Python script named data_processor.py that prints 'Hello World'.`

The Agent will read the template, convert the comments to Python style, and automatically add it to the top of the file.

---

## 🎯 Conclusion

By creating Skills, you transform a general AI model into an expert for your project:

- ✅ Systematize best practices
- ✅ Adhere to code review rules
- ✅ Automatically add license headers
- ✅ The Agent automatically knows how to work with your team

Instead of constantly reminding the AI to "remember to add the license" or "fix the commit format," now the Agent will do it automatically!

---

## ⚙️ Stateful and Local Configurations for Skills

Starting in June 2026, skills can be configured locally per project using a `config.json` file. This transitions skills from static rule definitions to stateful modules that customize their execution parameters based on the local workspace environment.

### Standard Configuration Structure

For skills requiring local parameters (e.g., testing URLs, timeout settings, viewport configurations), a local `config.json` should be placed under the skill directory in the workspace:

```
<project-root>/skills/<skill-name>/config.json
```
or 
```
<project-root>/.agent/skills/<skill-name>/config.json
```

A template file `config.json.template` should be provided alongside it for default reference.

#### Example: `config.json` for `webapp-testing`

```json
{
  "url": "http://localhost:3000",
  "take_screenshot": true,
  "check_a11y": false,
  "viewport": {
    "width": 1280,
    "height": 720
  },
  "timeout_ms": 30000,
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}
```

### Script Pattern for Loading Configuration (Python)

When writing Python runner scripts within a skill, follow this standard pattern to resolve config locations. Scripts must fallback gracefully to default values if no configuration exists or if some fields are missing:

```python
import os
import json
import sys

# 1. Initialize defaults
project_path = "."
url = "http://localhost:3000"
viewport = {"width": 1280, "height": 720}
timeout_ms = 30000

# 2. Parse command-line args for overrides/positionals
# ...

# 3. Resolve possible config paths
config_paths = [
    os.path.join(project_path, ".agent", "skills", "my-skill", "config.json"),
    os.path.join(project_path, "skills", "my-skill", "config.json"),
    os.path.join(os.getcwd(), ".agent", "skills", "my-skill", "config.json"),
    os.path.join(os.getcwd(), "skills", "my-skill", "config.json"),
]

# 4. Load configuration sequentially
for config_path in config_paths:
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
                # Apply config keys if not explicitly overwritten by command-line args
                if "url" in config:
                    url = config["url"]
                if "viewport" in config:
                    viewport = config["viewport"]
                if "timeout_ms" in config:
                    timeout_ms = config["timeout_ms"]
                break
        except Exception as e:
            sys.stderr.write(f"Warning: Failed to load config from {config_path}: {e}\n")
```

This pattern ensures that:
1. **Dynamic Defaults**: AI agents can inspect `config.json` to understand site configurations.
2. **Backwards Compatibility**: Scripts still accept parameters/overrides via CLI commands.
3. **Graceful Fallbacks**: Missing keys or malformed JSON files do not crash the script.

