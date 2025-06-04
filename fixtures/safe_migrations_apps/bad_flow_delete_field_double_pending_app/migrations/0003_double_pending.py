from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.fields import SafeRemoveField
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):

    dependencies = [
        ("bad_flow_delete_field_double_pending_app", "0002_delete_pending"),
    ]

    operations = [
        SafeRemoveField(
            model_name="testtable",
            name="field",
            deletion_action=DeletionAction.MOVE_TO_PENDING,
        ),
    ]
