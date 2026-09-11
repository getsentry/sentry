from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    dependencies = [
        ("squash_bake_pending_model_app", "0001_squashed"),
    ]

    operations = [
        SafeDeleteModel(
            name="TestTable",
            deletion_action=DeletionAction.DELETE,
        ),
    ]
