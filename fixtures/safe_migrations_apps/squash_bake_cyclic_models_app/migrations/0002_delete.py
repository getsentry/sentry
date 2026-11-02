from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    dependencies = [
        ("squash_bake_cyclic_models_app", "0001_squashed"),
    ]

    operations = [
        SafeDeleteModel(name="Cell", deletion_action=DeletionAction.DELETE),
        SafeDeleteModel(name="Execution", deletion_action=DeletionAction.DELETE),
    ]
