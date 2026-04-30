from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    is_post_deployment = False

    dependencies = [
        ("sentry", "1074_remove_dashboardtombstone"),
    ]

    operations = [
        SafeDeleteModel(
            name="DashboardTombstone",
            deletion_action=DeletionAction.DELETE,
        ),
    ]
