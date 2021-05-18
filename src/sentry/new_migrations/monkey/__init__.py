from django import VERSION

from sentry.new_migrations.monkey.executor import SentryMigrationExecutor
from sentry.new_migrations.monkey.writer import SENTRY_MIGRATION_TEMPLATE

LAST_VERIFIED_DJANGO_VERSION = (1, 11)
CHECK_MESSAGE = """Looks like you're trying to upgrade Django! Since we monkeypatch
the Django migration library in several places, please verify that we have the latest
code, and that the monkeypatching still works as expected. Currently the main things
to check are:
 - `django.db.migrations.executor.MigrationExecutor`. The `is_dangerous` flag should
   continue to work here when we set `MIGRATION_SKIP_DANGEROUS=1` as an environment
   variable. Confirm that the structure of the class hasn't drastically changed.
- `django.db.migrations.writer.MIGRATION_TEMPLATE`. Verify that the template hasn't
  significantly changed. Details on what we've changed are in a comment on
  `sentry.migrations.monkey.writer.SENTRY_MIGRATION_TEMPLATE`

When you're happy that these changes are good to go, update
`LAST_VERIFIED_DJANGO_VERSION` to the version of Django you're upgrading to. If the
changes are backwards incompatible, change the monkeying to handle both versions.
"""

if VERSION[:2] > LAST_VERIFIED_DJANGO_VERSION:
    raise Exception(CHECK_MESSAGE)


def monkey_migrations():
    # This import needs to be below the other imports for `executor` and `writer` so
    # that we can successfully monkeypatch them.
    from django.db.migrations import executor, migration, writer

    # monkeypatch Django's migration executor and template.
    executor.MigrationExecutor = SentryMigrationExecutor
    migration.Migration.initial = None
    writer.MIGRATION_TEMPLATE = SENTRY_MIGRATION_TEMPLATE
