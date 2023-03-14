from sentry.mediators import sentry_app_installations, service_hooks
from sentry.models import ServiceHook
from sentry.testutils.cases import TestMigrations

DEFAULT_ENVIRONMENT_NAME = "production"


class MigrateMonitorEnvironmentBackfillInitialTest(TestMigrations):
    migrate_from = "0382_add_installation_id_to_service_hook"
    migrate_to = "0383_backfill_installation_ids"

    def setup_before_migration(self, apps):
        sentry_app_installations.Creator.run(
            organization=self.organization, slug="buggabugga", user=self.user, notify=False
        )
        self.installation_hook = ServiceHook.objects.last()
        assert self.installation_hook
        self.project_hook = service_hooks.Creator.run(
            actor=self.user, projects=[self.project], events=[], url="https://www.example.org"
        )
        assert self.project_hook != self.installation_hook

    def test(self):
        assert self.installation_hook.installation_id == self.installation_hook.actor_id
        assert self.installation_hook.actor_id

        assert self.project_hook.installation_id is None
        assert self.project_hook.actor_id
