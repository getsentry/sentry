from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    atomic = False

    dependencies = [
        ("bad_flow_delete_pending_with_fk_constraints_app", "0001_initial"),
    ]

    operations = [
        SafeDeleteModel(
            name="TestTable",
            deletion_action=DeletionAction.MOVE_TO_PENDING,
        ),
    ]
