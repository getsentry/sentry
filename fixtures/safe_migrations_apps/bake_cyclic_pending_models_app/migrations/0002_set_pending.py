from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    dependencies = [
        ("bake_cyclic_pending_models_app", "0001_initial"),
    ]

    operations = [
        SafeDeleteModel(name="Link", deletion_action=DeletionAction.MOVE_TO_PENDING),
        SafeDeleteModel(name="Cell", deletion_action=DeletionAction.MOVE_TO_PENDING),
        SafeDeleteModel(name="Execution", deletion_action=DeletionAction.MOVE_TO_PENDING),
    ]
