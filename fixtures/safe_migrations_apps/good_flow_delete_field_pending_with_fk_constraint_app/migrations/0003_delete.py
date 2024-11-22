from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.fields import SafeRemoveField
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    dependencies = [
        (
            "good_flow_delete_field_pending_with_fk_constraint_app",
            "0002_remove_constraints_and_pending",
        ),
    ]

    operations = [
        SafeRemoveField(
            model_name="testtable",
            name="fk_table",
            deletion_action=DeletionAction.DELETE,
        ),
    ]
