from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.fields import SafeRemoveField
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    atomic = False

    dependencies = [
        ("bad_flow_delete_field_pending_with_fk_constraint_app", "0001_initial"),
    ]

    operations = [
        SafeRemoveField(
            model_name="testtable",
            name="fk_table",
            deletion_action=DeletionAction.MOVE_TO_PENDING,
        ),
    ]
