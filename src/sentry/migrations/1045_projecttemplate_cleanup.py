from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.fields import SafeRemoveField
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    is_post_deployment = False

    dependencies = [
        ("sentry", "1044_remove_projecttemplate_model"),
    ]

    operations = [
        SafeRemoveField(
            model_name="project",
            name="template",
            deletion_action=DeletionAction.DELETE,
        ),
        SafeDeleteModel(
            name="ProjectTemplateOption",
            deletion_action=DeletionAction.DELETE,
        ),
        SafeDeleteModel(
            name="ProjectTemplate",
            deletion_action=DeletionAction.DELETE,
        ),
    ]
