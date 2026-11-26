from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.special import SafeRunSQL


class Migration(CheckedMigration):
    is_post_deployment = True

    dependencies = [("migration_test_app", "0001_create_migration_run_test")]

    # Long running query used to test cancellation of `sentry migrations run`.
    operations = [SafeRunSQL("SELECT pg_sleep(60);", use_statement_timeout=False)]
