from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.fields import SafeRemoveField
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    dependencies = [
        ("squash_bake_pending_field_app", "0001_squashed"),
    ]

    operations = [
        SafeRemoveField(
            model_name="testtable",
            name="field",
            deletion_action=DeletionAction.DELETE,
        ),
    ]
