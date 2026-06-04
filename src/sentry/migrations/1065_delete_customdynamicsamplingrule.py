from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    is_post_deployment = False

    dependencies = [
        ("sentry", "1064_eventattachment_date_expires_now"),
    ]

    operations = [
        SafeDeleteModel(
            name="CustomDynamicSamplingRuleProject",
            deletion_action=DeletionAction.DELETE,
        ),
        SafeDeleteModel(
            name="CustomDynamicSamplingRule",
            deletion_action=DeletionAction.DELETE,
        ),
    ]
