# Claude Code Extensions

Claude Code extends the [Agent Skills specification](https://agentskills.io/specification) with additional frontmatter fields and features. These are optional — skills that use only the base spec remain portable across all compatible tools.

## Extended Frontmatter Fields

| Field | Description |
|-------|-------------|
| `argument-hint` | Hint shown during autocomplete (e.g., `[issue-number]`, `[filename] [format]`) |
| `disable-model-invocation` | Set `true` to prevent Claude from auto-loading; manual `/name` only |
| `user-invocable` | Set `false` to hide from `/` menu; background knowledge only |
| `model` | Override the model when this skill is active |
| `context` | Set to `fork` to run in an isolated subagent |
| `agent` | Which subagent type to use with `context: fork` (e.g., `Explore`, `Plan`) |
| `hooks` | Hooks scoped to the skill's lifecycle |

### Invocation Control

By default, both users and Claude can invoke any skill. Two fields restrict this:

```yaml
# Only the user can invoke (manual trigger for side-effects like deploy)
disable-model-invocation: true

# Only Claude can invoke (background knowledge, not a meaningful user action)
user-invocable: false
```

| Setting | User can invoke | Claude can invoke |
|---------|----------------|-------------------|
| (default) | Yes | Yes |
| `disable-model-invocation: true` | Yes | No |
| `user-invocable: false` | No | Yes |

### Subagent Execution

Set `context: fork` to run a skill in an isolated subagent. The skill content becomes the prompt — the subagent won't have access to conversation history.

```yaml
---
name: deep-research
description: Research a topic thoroughly
context: fork
agent: Explore
---

Research $ARGUMENTS thoroughly:
1. Find relevant files using Glob and Grep
2. Read and analyze the code
3. Summarize findings with specific file references
```

Only use `context: fork` with skills that contain explicit tasks. Skills that provide guidelines without a task ("use these API conventions") return nothing useful from a subagent.

## String Substitutions

Skills support dynamic values in content:

| Variable | Description |
|----------|-------------|
| `$ARGUMENTS` | All arguments passed when invoking the skill |
| `$ARGUMENTS[N]` | Specific argument by 0-based index |
| `$N` | Shorthand for `$ARGUMENTS[N]` (e.g., `$0`, `$1`) |
| `${CLAUDE_SESSION_ID}` | Current session ID |

```yaml
---
name: fix-issue
description: Fix a GitHub issue
disable-model-invocation: true
---

Fix GitHub issue $ARGUMENTS following our coding standards.
```

If `$ARGUMENTS` is not present in the content, arguments are appended as `ARGUMENTS: <value>`.

## Dynamic Context Injection

The `` !`command` `` syntax runs shell commands before the skill content reaches Claude. Output replaces the placeholder.

```yaml
---
name: pr-summary
description: Summarize changes in a pull request
context: fork
agent: Explore
---

## Pull request context
- PR diff: !`gh pr diff`
- PR comments: !`gh pr view --comments`

## Your task
Summarize this pull request.
```

Commands execute immediately as preprocessing — Claude only sees the output.

## Skill Locations

| Level | Path | Scope |
|-------|------|-------|
| Enterprise | Managed settings | All org users |
| Personal | `~/.claude/skills/<name>/SKILL.md` | All your projects |
| Project | `.claude/skills/<name>/SKILL.md` | This project |
| Plugin | `<plugin>/skills/<name>/SKILL.md` | Where plugin is enabled |

Higher-priority locations win when names collide (enterprise > personal > project). Plugin skills use `plugin-name:skill-name` namespacing.

In monorepos, Claude Code auto-discovers skills from nested `.claude/skills/` directories relative to the files being edited.
