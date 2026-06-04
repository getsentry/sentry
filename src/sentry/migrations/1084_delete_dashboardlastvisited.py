from sentry.new_migrations.migrations import CheckedMigration
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction


class Migration(CheckedMigration):
    is_post_deployment = False

    dependencies = [
        ("sentry", "1083_remove_dashboardlastvisited"),
    ]

    operations = [
        SafeDeleteModel(
            name="DashboardLastVisited",
            deletion_action=DeletionAction.DELETE,
        ),
    ]
