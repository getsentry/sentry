from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    dependencies = [
        ("good_flow_delete_pending_with_fk_constraints_app", "0002_remove_constraints_and_pending"),
    ]

    operations = [
        SafeDeleteModel(
            name="TestTable",
            deletion_action=DeletionAction.DELETE,
        ),
    ]
