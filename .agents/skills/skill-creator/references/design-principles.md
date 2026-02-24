# Skill Design Principles

Principles for writing effective agent skills. A skill is a set of instructions injected into an agent's context window — every line competes for space with the user's actual task.

## Conciseness

The context window is shared between the skill instructions and the agent's working memory. Only include what the agent doesn't already know.

**Include:**
- Domain knowledge specific to this task
- Decision logic the agent can't infer
- Output format requirements
- Concrete examples of correct behavior

**Omit:**
- General programming knowledge
- How to use standard tools (Read, Grep, Bash)
- Obvious instructions ("be thorough", "check for errors")
- Lengthy explanations when a table or example suffices

**Rule of thumb:** If a senior engineer would skip reading it, the agent doesn't need it either.

## Degrees of Freedom

Match the specificity of your instructions to the fragility of the task.

| Fragility | Instruction Style | Example |
|-----------|------------------|---------|
| **High** — wrong output is costly | Prescriptive steps, exact formats | Commit message format, API output schema |
| **Medium** — multiple valid approaches | Guidelines with examples | Code review priorities, refactoring strategy |
| **Low** — many correct answers | Goals and constraints only | "Explain this code", "Summarize these changes" |

Over-constraining low-fragility tasks wastes context and limits the agent. Under-constraining high-fragility tasks leads to inconsistent results.

## Progressive Disclosure

Structure skills so agents load only what they need, when they need it.

**Three-tier loading:**

1. **Metadata** (always loaded) — frontmatter `name` and `description` determine whether the skill activates
2. **Instructions** (loaded on activation) — the SKILL.md body with the core workflow
3. **Resources** (loaded on demand) — reference files, loaded conditionally based on the task context

```markdown
## Step 3: Load Language Guide

| File Extension | Read This Reference |
|---------------|-------------------|
| `.py`         | `${CLAUDE_SKILL_ROOT}/references/python.md` |
| `.js`, `.ts`  | `${CLAUDE_SKILL_ROOT}/references/javascript.md` |
```

This keeps the base context small while making deep knowledge available when needed.

## Description as Trigger

The `description` field determines when agents activate the skill. It must contain the phrases users actually say.

**Write in third person** — the description is injected into the system prompt, and inconsistent point-of-view causes discovery problems:
```yaml
# Good — third person
description: Processes Excel files and generates reports. Use when working with spreadsheets.

# Bad — first person
description: I can help you process Excel files.

# Bad — second person
description: You can use this to process Excel files.
```

**Include all "when to use" information in the description**, not in the body. The body is only loaded after triggering, so "When to Use This Skill" sections in the body are not helpful.

**Effective descriptions:**
```yaml
# Good — includes natural trigger phrases
description: Create commit messages following Sentry conventions. Use when committing code changes, writing commit messages, or formatting git history.

# Good — includes action verbs and domain terms
description: Security code review for vulnerabilities. Use when asked to "security review", "find vulnerabilities", "check for security issues", "audit security", "OWASP review".
```

**Ineffective descriptions:**
```yaml
# Bad — too vague, no trigger phrases
description: A helpful skill for code quality.

# Bad — describes internals, not when to use it
description: Runs a Python script that parses AST and generates reports.

# Bad — too short, won't match varied user phrasing
description: Code review.
```

**Pattern:** `<What it does>. Use when <trigger phrases>. <Key capabilities>.`

## Imperative Voice

Skills are instructions to an agent, not documentation for humans. Write in imperative voice throughout.

| Imperative (correct) | Descriptive (avoid) |
|---------------------|-------------------|
| Read the diff and identify changes | This skill reads the diff and identifies changes |
| Report findings in the table format below | Findings should be reported in the table format below |
| Ask the user before making destructive changes | The agent may want to ask the user before making destructive changes |
| Skip test files unless explicitly requested | Test files are generally skipped unless explicitly requested |

The agent interprets imperative instructions as direct commands. Descriptive language introduces ambiguity about whether an action is required or optional.

## Consistent Terminology

Pick one term for each concept and use it throughout the skill. Inconsistent terminology confuses agents and leads to inconsistent behavior.

| Do (pick one) | Don't (mix these) |
|---------------|-------------------|
| "API endpoint" everywhere | "API endpoint", "URL", "API route", "path" |
| "field" everywhere | "field", "box", "element", "control" |
| "extract" everywhere | "extract", "pull", "get", "retrieve" |

## Avoid Duplication

Information should live in either SKILL.md or reference files, not both. Prefer reference files for detailed content and SKILL.md for the core procedural workflow.

Similarly, don't repeat conventions already in `CLAUDE.md` or `AGENTS.md`. Reference them instead: "Follow the commit conventions in CLAUDE.md" rather than copying the entire format spec.

## Avoid Time-Sensitive Information

Don't include information that will become outdated:

```markdown
# Bad — will become wrong
If you're doing this before August 2025, use the old API.

# Good — use "old patterns" section
## Current method
Use the v2 API endpoint.

## Legacy patterns (deprecated)
The v1 API is no longer supported.
```

## Long Reference Files

For reference files longer than 100 lines, include a table of contents at the top so agents can see the full scope when previewing:

```markdown
# API Reference

## Contents
- Authentication and setup
- Core methods (create, read, update, delete)
- Advanced features (batch operations, webhooks)
- Error handling patterns

## Authentication and setup
...
```

For very large reference files (>10k words), include grep search patterns in SKILL.md so agents can find relevant sections:

```markdown
Find specific metrics using grep:
- Revenue data: `grep -i "revenue" ${CLAUDE_SKILL_ROOT}/references/finance.md`
- Pipeline data: `grep -i "pipeline" ${CLAUDE_SKILL_ROOT}/references/sales.md`
```
