---
name: django-queries
description: Write Django ORM queries, raw SQL, and transactions that work on Sentry's production databases. Use when writing or reviewing database access code in Sentry. Not for migration files (use generate-migration) or model design (use django-models).
---

# Django Queries on Sentry's Databases

## Tables on Separate Databases

Within a silo, production keeps some tables on separate Postgres databases. The router picks the connection per model, so single-table ORM calls just work, but one SQL statement or one transaction cannot span two databases. Tests rarely catch this: Sentry's test router (`TestSiloMultiDatabaseRouter` in `src/sentry/db/router.py`) splits out only the cron monitor tables.

The table-to-database map is `_default_db_routing_map` in getsentry's `getsentry/db/router.py`. Unlisted tables are on `default`, and `SENTRY_DB_ROUTING_MAP_OVERRIDES` in `getsentry/conf/settings/` adds per-environment entries. Read it from a getsentry checkout (usually a sibling of this repo) or with `gh api -H "Accept: application/vnd.github.raw" repos/getsentry/getsentry/contents/getsentry/db/router.py`. If you cannot read getsentry, say so instead of assuming the tables share a database.

Look up every table involved before you:

- **Query more than one table in one statement**: `id__in=<queryset>`, `Subquery`/`Exists`, a join across a foreign key, or raw SQL. Across databases, run separate queries and pass IDs through Python (`list(qs.values_list("id", flat=True))`). For raw SQL, take the connection from the router (`connections[router.db_for_read(Model)]`), not `django.db.connection`.
- **Write to more than one model in a `transaction.atomic` block**: it only covers the database named in `using`, usually `router.db_for_write(Model)`.
- **Add a foreign key or a model**: reference a table on another database with a plain `BoundedBigIntegerField` ID column, as `ReleaseFile.release_id` does. A new table is on `default` unless it is added to the map.
- **Write a migration**: `RunPython` and `SafeRunSQL` also need routing hints. Use the **`generate-migration`** skill.
