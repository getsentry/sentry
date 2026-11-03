# Backup tests

These tests start from an empty database, import a backup `.json` file, optionally transform it, export it again, and diff the two. The diff must contain only the changes the test made.

## Add or change a relocatable model

The suite checks every model whose `__relocation_scope__` is not `RelocationScope.Excluded`. When you add such a model, or add fields to one, update the following until CI passes.

1. **Exhaustive fixtures.** Create at least one instance of the model in the matching `create_exhaustive_*` method in `src/sentry/testutils/helpers/backups.py`. Use `create_exhaustive_organization` for organization or project-scoped models and `create_exhaustive_user` for user-scoped ones. Without it, `test_exhaustive.py` and the `ScopingTests` in `test_exports.py` and `test_imports.py` fail with "Some `expected_models` entries were not found" or "models were not included in the export".
2. **Comparators.** If a field changes on import, such as `date_added` and `date_updated` from `DefaultFieldsModel`, register a comparator for the model in `get_default_comparators()` in `src/sentry/backup/comparators.py`, for example `DateUpdatedComparator("date_updated", "date_added")`. Without it, `test_exhaustive_dirty_pks` fails with `UnequalJSON` findings on those fields.
3. **Coverage checks.** `test_coverage.py` may also require:
   - a collision test in `test_imports.py`, registered in `COLLISION_TESTED`, if the model has unique constraints not based on `Organization` or `Global`-scoped foreign keys.
   - a dynamic relocation scope test in `test_models.py`, registered in `DYNAMIC_RELOCATION_SCOPE_TESTED`, if `__relocation_scope__` is a set of scopes.

## Comparators

Some fields cannot match byte for byte after an import and export cycle. An import rewrites `date_updated`, and some hashes change. A comparator checks the relation the field must keep instead, for example that the exported `date_updated` is not earlier than the imported one.

Comparators subclass `JSONScrubbingComparator` in `src/sentry/backup/comparators.py`, and `get_default_comparators()` maps each model to its comparators. Each comparator implements `compare()`. Its `scrub()` then moves the compared fields out of `fields` into a separate `scrubbed` dictionary on both sides, so the text diff skips them. All `compare()` calls for a model run before any `scrub()` call, so two comparators on the same field do not change each other's input.

## Snapshots

Snapshot fixtures live in `fixtures/backup/`. `fresh-install.json` is the database state right after `./install.sh` creates a new `self-hosted` instance.
