# Group action log

Action log entries are kept effectively forever and are never migrated. Read the `GroupAction` docstring in `types.py` before adding or changing a `GroupAction` subclass.

## GroupAction subclasses (strict)

- A payload must be fully interpretable from its subclass, types, and docs alone. Never implementation-defined.
- No open-ended types (`dict[str, Any]`, `list[dict[str, str | dict[str, str]]]`). Use nested `BaseModel`s, `Literal`, or enums. Existing `TODO Break out as separate model?` fields are debt, not precedent.
- Translate loosely shaped sources (upstream APIs, `Activity.data`) into a fixed shape at publish time.
- Document what IDs refer to, units, and what `None` means.

## Evolving a subclass

- Every stored payload must still parse and mean the same thing. Never change a field's meaning or reuse a `GroupActionType` value.
- New fields: optional with a default. Legacy shapes: translate explicitly on read (e.g. `@root_validator(pre=True)`).
- Removing or renaming a field silently drops it from old payloads; unknown keys are ignored.
- Add a test in `tests/sentry/issues/action_log/test_types.py` that parses a literal snapshot of current stored data.
- Significant change: add a new `GroupActionType` and subclass; keep the old one registered.
