---
name: add-ratchet
description: Add a new ratchet to prevent new cases of old patterns. Use when asked to "add a ratchet", "ratchet down", "prevent new usage of", "track migration of", or lock in a pattern that should decrease over time.
---

# Add a Ratchet

A ratchet tracks a pattern that should decrease over time and prevents regression. The ratchet check fails if the count increases beyond the ceiling. See https://qntm.org/ratchet

## Steps

### 1. Understand what to ratchet

Ask the user (if not already clear) what pattern they want to prevent new cases of. You need:

- **Pattern**: A ripgrep regex matching the old/deprecated usage
- **File glob**: Which files to search — use aliases `ALL_TS` or `ALL_PY`, or a custom glob
- **Description**: A human-readable explanation of what should be used instead
- **Fix** (optional): A regex find/replace pair showing how to migrate

### 2. Test the pattern

Use the `test` subcommand to verify the pattern matches what you expect:

```bash
python -m tools.ratchet test '<pattern>' '<file_glob>'
```

This prints the match count. Use `-v` to see each match with file, line, and column:

```bash
python -m tools.ratchet test -v '<pattern>' '<file_glob>'
```

Iterate on the pattern until it matches exactly the cases you want. The count becomes the ceiling.

### 3. Add the ratchet to `tools/ratchet.py`

Add a new `Ratchet` entry to the `RATCHETS` list:

```python
Ratchet(
    id="<kebab-case-id>",
    team="<team-name>",
    description="<what to do instead>",
    pattern=r"<ripgrep regex>",
    ceiling=<current_count>,
    file_glob="<glob>",
),
```

Rules:

- `id` must be unique, kebab-case, and descriptive
- `team` identifies the owning team
- `ceiling` must exactly match the current count (not rounded, not padded)
- `pattern` must be a valid ripgrep regex (raw string)
- `file_glob` must match what `git ls-files` accepts; use `ALL_TS` or `ALL_PY` aliases when appropriate

### 4. Verify

Run the ratchet check to confirm it passes:

```bash
python -m tools.ratchet check -v <ratchet-id>
```

The output should show `OK` with the count matching the ceiling.
