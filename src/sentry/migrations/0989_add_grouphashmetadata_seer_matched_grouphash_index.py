# Generated to fix OperationalError: canceling statement due to user request
# in sentry.deletions.tasks.groups.delete_groups_for_project
#
# The issue occurs when deleting GroupHash objects, which triggers an automatic
# UPDATE query on sentry_grouphashmetadata to set seer_matched_grouphash_id = NULL
# due to the on_delete=models.SET_NULL behavior. Without an index on this column,
# the query performs a full table scan when using large IN clauses, leading to
# query timeouts and cancellations.

from django.db import migrations

from sentry.new_migrations.migrations import CheckedMigration


class Migration(CheckedMigration):
    # This migration is safe to run
    is_dangerous = False

    dependencies = [
        ("sentry", "0988_data_forwarding"),
    ]

    operations = [
        migrations.RunSQL(
            # Create index concurrently to avoid blocking writes during index creation
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS sentry_grouphashmetadata_seer_matched_grouphash_id ON sentry_grouphashmetadata (seer_matched_grouphash_id);",
            # Drop the index if rolling back
            "DROP INDEX IF EXISTS sentry_grouphashmetadata_seer_matched_grouphash_id;",
        ),
    ]
