from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.special import SafeRunSQL


class Migration(CheckedMigration):
    is_post_deployment = False

    dependencies = [
        ("sentry", "1077_add_is_disabled_field"),
    ]

    operations = [
        # The field was removed from Django model state in migration 0077 (May 2020)
        # using plain RemoveField, before the SafeRemoveField two-step process existed.
        # Since the field never went through MOVE_TO_PENDING, SafeRemoveField(DELETE)
        # can't be used here — it would fail the pending_deletion_fields check.
        SafeRunSQL(
            sql="""
            ALTER TABLE "sentry_querysubscription" DROP COLUMN IF EXISTS "time_window";
            """,
            reverse_sql="",
            hints={"tables": ["sentry_querysubscription"]},
        ),
    ]
