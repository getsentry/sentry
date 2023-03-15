from sentry.mediators import sentry_app_installations, service_hooks
from sentry.models import ServiceHook
from sentry.testutils.cases import TestMigrations


class BackfillInstallationIdsTest(TestMigrations):
    migrate_from = "0383_mv_user_avatar"
    migrate_to = "0384_backfill_installation_ids"

    def setup_before_migration(self, apps):
        app = self.create_sentry_app(slug="helloworld")
        sentry_app_installations.Creator.run(
            organization=self.organization, slug=app.slug, user=self.user, notify=False
        )
        self.installation_hook = ServiceHook.objects.last()
        assert self.installation_hook
        self.project_hook = service_hooks.Creator.run(
            actor=self.user,
            projects=[self.project],
            events=[],
            url="https://www.example.org",
            organization=self.organization,
        )
        assert self.project_hook != self.installation_hook

    def test(self):
        assert self.installation_hook.installation_id == self.installation_hook.actor_id
        assert self.installation_hook.actor_id

        assert self.project_hook.installation_id is None
        assert self.project_hook.actor_id
