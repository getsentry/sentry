from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    dependencies = [
        ("good_flow_delete_simple_app", "0002_set_pending"),
    ]

    operations = [
        SafeDeleteModel(
            name="TestTable",
            deletion_action=DeletionAction.DELETE,
        ),
    ]
