---
name: skill-creator
description: Create new agent skills following the Agent Skills specification. Use when asked to "create a skill", "add a new skill", "write a skill", "make a skill", "build a skill", or scaffold a new skill with SKILL.md. Guides through requirements, planning, writing, registration, and verification.
---

<!--
Adapted from skill-creator implementations by Anthropic and OpenAI:
https://github.com/anthropics/skills/tree/main/skills/skill-creator
https://github.com/openai/skills/tree/main/skills/.system/skill-creator

References:
- Agent Skills specification: https://agentskills.io/specification
- Skill authoring best practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Validation library: https://github.com/agentskills/agentskills/tree/main/skills-ref
-->

# Create a New Skill

Guide the user through creating a new agent skill following the [Agent Skills specification](https://agentskills.io/specification). Follow each step in order.

## Step 1: Understand the Skill

Gather requirements before writing anything.

**Ask the user:**
1. What should this skill do? (one sentence)
2. When should an agent use it? (trigger phrases users would say)
3. What tools does the skill need? (Read, Grep, Glob, Bash, Task, WebFetch, etc.)
4. Where should the skill live? (which plugin or directory)

**Determine the skill name:**
- Lowercase letters, digits, and hyphens only (`a-z`, `0-9`, `-`)
- 1-64 characters; must not start or end with `-`; no consecutive hyphens (`--`)
- Descriptive and unique among existing skills
- Prefer action-oriented names: `processing-pdfs`, `fix-issue`, `code-review`
- Check the target skills directory to avoid name collisions

**Choose a complexity tier:**

| Tier | Structure | Use When |
|------|-----------|----------|
| **Simple** | `SKILL.md` only | Self-contained instructions under ~200 lines |
| **With references** | `SKILL.md` + `references/` | Domain knowledge that agents load conditionally |
| **With scripts** | `SKILL.md` + `scripts/` | Workflow automation needing Python scripts |
| **Full** | All of the above | Complex skills with automation and domain knowledge |

Read `${CLAUDE_SKILL_ROOT}/references/design-principles.md` for guidance on keeping skills focused and concise.

## Step 2: Plan the Skill

Analyze how each use case would be executed from scratch. Identify what reusable resources would help when executing these tasks repeatedly.

For each concrete example, ask:
1. What code would be rewritten every time? → candidate for `scripts/`
2. What documentation is needed to inform decisions? → candidate for `references/`
3. What templates or assets are used in output? → candidate for `assets/`

Example analysis:
- "Rotate a PDF" → rotating requires rewriting the same code → `scripts/rotate_pdf.py`
- "Query BigQuery metrics" → need table schemas each time → `references/schema.md`
- "Build a frontend app" → same boilerplate HTML/React → `assets/hello-world/`

## Step 3: Study Existing Skills

Before writing, study 1-2 existing skills that match the chosen tier. Look for skills in the target repository or plugin to understand local conventions.

Read `${CLAUDE_SKILL_ROOT}/references/skill-patterns.md` for concrete examples of each tier.

Also read `CLAUDE.md` (or `AGENTS.md`) at the repository root for repo-specific conventions that the skill should follow.

## Step 4: Write the SKILL.md

Create `<skill-directory>/<name>/SKILL.md`.

### Frontmatter

The YAML frontmatter **must** be the first thing in the file. No comments or blank lines before `---`.

```yaml
---
name: <skill-name>
description: <what it does>. Use when <trigger phrases>. <key capabilities>.
---
```

**Required fields:**
- `name` — must match the directory name exactly
- `description` — up to 1024 chars, no angle brackets (`<` or `>`); include trigger keywords that help agents match user intent

**Optional fields:**
- `allowed-tools` — comma-separated list (e.g., `Read, Grep, Glob, Bash`); omit to allow all tools
- `license` — license name or path (add when vendoring external content)
- `metadata` — arbitrary key-value mapping for additional metadata
- `compatibility` — environment requirements (max 500 chars); most skills don't need this

For Claude Code-specific fields (`argument-hint`, `disable-model-invocation`, `context`, etc.), read `${CLAUDE_SKILL_ROOT}/references/claude-code-extensions.md`.

### Description Guidelines

The description is the **primary trigger mechanism** — it determines when agents activate the skill. All "when to use" information belongs here, not in the body.

**Write in third person:**
- Good: "Processes Excel files and generates reports. Use when..."
- Bad: "I can help you process Excel files" or "You can use this to..."

**Include natural trigger phrases:**
```yaml
# Good — specific triggers users would actually say
description: Security code review for vulnerabilities. Use when asked to "security review", "find vulnerabilities", "check for security issues", "audit security".

# Bad — too vague, no trigger phrases
description: A helpful skill for code quality.
```

**Pattern:** `<What it does>. Use when <trigger phrases>. <Key capabilities>.`

### Body Guidelines

Write the body in **imperative voice** — these are instructions, not documentation.

| Do | Don't |
|----|-------|
| "Read the file and extract..." | "This skill reads the file and extracts..." |
| "Report only HIGH confidence findings" | "The agent should report only HIGH confidence findings" |
| "Ask the user which option to use" | "You may want to ask the user..." |

**Structure:**
1. Start with a one-line summary of what the skill does
2. Organize steps with `## Step N: Title` headings
3. Use tables for decision logic and mappings
4. Include concrete examples of expected output
5. End with validation criteria or exit conditions

For workflow and output patterns, read:
- `${CLAUDE_SKILL_ROOT}/references/workflow-patterns.md` — sequential workflows, feedback loops, plan-validate-execute
- `${CLAUDE_SKILL_ROOT}/references/output-patterns.md` — template, examples, and structured data patterns

**Size limits:**
- Keep SKILL.md under **500 lines** (< 5000 tokens recommended)
- If approaching the limit, move reference material to `references/` files
- Load reference files conditionally based on context (not all at once)

**Use consistent terminology** — pick one term for each concept and stick with it throughout. Don't alternate between "API endpoint", "URL", "route", and "path".

### Attribution

If the skill is based on or adapted from external sources, add an HTML comment **after** the frontmatter closing `---`:

```markdown
---
name: example
description: ...
---

<!--
Based on [Original Name] by [Author/Org]:
https://github.com/example/original-source
-->
```

## Step 5: Create Supporting Files

### What to Include

Only include files that directly support the skill's function.

### What NOT to Include

Do not create extraneous documentation or auxiliary files:
- README.md, INSTALLATION_GUIDE.md, QUICK_REFERENCE.md, CHANGELOG.md

A skill should contain only what an agent needs to do the job. Not setup procedures, not user-facing docs, not development history.

### References (`references/`)

Use for domain knowledge the agent loads conditionally.

```
<name>/
├── SKILL.md
└── references/
    ├── topic-a.md
    └── topic-b.md
```

Reference from SKILL.md with:
```markdown
Read `${CLAUDE_SKILL_ROOT}/references/topic-a.md` for details on [topic].
```

Guidelines:
- Keep each reference file focused on one topic
- Keep references **one level deep** from SKILL.md (no nested reference chains)
- For files over 100 lines, add a table of contents at the top
- For files over 10k words, include grep search patterns in SKILL.md
- Information should live in either SKILL.md or references, not both

### Scripts (`scripts/`)

Use for workflow automation that benefits from structured Python.

```
<name>/
├── SKILL.md
└── scripts/
    └── do_thing.py
```

**Script requirements:**
- Always use `uv run` to execute: `uv run ${CLAUDE_SKILL_ROOT}/scripts/do_thing.py`
- Add PEP 723 inline metadata for dependencies:

```python
# /// script
# requires-python = ">=3.12"
# dependencies = ["requests"]
# ///
```

- Output structured JSON for agent consumption
- Run from the **repository root**, not the skill directory
- Document the script's interface in SKILL.md (arguments, output format)
- Handle errors explicitly — don't punt to the agent

### Assets (`assets/`)

Use for static files used in the skill's output (templates, images, boilerplate code, fonts). These are not loaded into context — they're copied or used directly.

### LICENSE

Include a LICENSE file in the skill directory when vendoring content with specific licensing requirements.

## Step 6: Validate the Skill

Run the validation script to catch issues early:

```bash
uv run ${CLAUDE_SKILL_ROOT}/scripts/quick_validate.py <path/to/skill-directory>
```

The script checks frontmatter format, required fields, naming rules, and common mistakes. Fix any errors and re-run until validation passes.

Alternatively, use the upstream validation tool:
```bash
skills-ref validate <path/to/skill-directory>
```

## Step 7: Register the Skill

Registration steps vary by repository. Check the repository's `CLAUDE.md` or `README.md` for specific instructions.

1. **Verify directory-name match** — confirm the directory name matches the `name` field in SKILL.md frontmatter exactly
2. **Update documentation** — add the skill to any skills index or table in README.md
3. **Update permissions** — if the repo has `.claude/settings.json`, add `Skill(<plugin>:<name>)` to the `permissions.allow` array
4. **Check CLAUDE.md** — read the repository's `CLAUDE.md` for any additional registration steps specific to that project

## Step 8: Verify

Run through this checklist before finishing:

### Frontmatter
- [ ] `name` matches directory name
- [ ] `name` uses only lowercase letters, digits, hyphens (no leading/trailing/consecutive hyphens)
- [ ] `description` is under 1024 characters, no angle brackets
- [ ] `description` is in third person and includes trigger keywords
- [ ] All "when to use" info is in description, not in body
- [ ] No content before the opening `---`

### Content
- [ ] SKILL.md is under 500 lines
- [ ] Written in imperative voice
- [ ] Steps are numbered and clear
- [ ] Examples of expected output included
- [ ] Consistent terminology throughout
- [ ] Reference files loaded conditionally (not unconditionally)
- [ ] No extraneous files (README.md, CHANGELOG.md, etc.)

### Registration
- [ ] Directory name matches frontmatter `name`
- [ ] Skill added to repo documentation (README or equivalent)
- [ ] Permissions updated (if applicable)
- [ ] Any repo-specific registration steps completed (check CLAUDE.md)

### Scripts (if applicable)
- [ ] Uses `uv run ${CLAUDE_SKILL_ROOT}/scripts/...`
- [ ] Has PEP 723 inline metadata
- [ ] Outputs structured JSON
- [ ] Handles errors explicitly
- [ ] Documented in SKILL.md

### Validation
- [ ] `uv run ${CLAUDE_SKILL_ROOT}/scripts/quick_validate.py` passes
- [ ] Tested with a real usage scenario

Report any issues found and fix them before completing.
