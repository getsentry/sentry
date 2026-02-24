from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import Action


class TestMigrateActionsSentryAppData(TestMigrations):
    migrate_from = "0107_fix_email_action_fallthrough_type"
    migrate_to = "0108_remove_sentry_app_identifier_from_action"
    app = "workflow_engine"

    def setup_initial_state(self) -> None:
        self.org = self.create_organization(name="test-org")
        self.user = self.create_user()

        self.sentry_app = self.create_sentry_app(name="foo", organization=self.org)
        self.installation = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.user
        )
        self.sentry_app_id_action = Action.objects.create(
            type=Action.Type.SENTRY_APP,
            config={
                "target_type": ActionTarget.SENTRY_APP,
                "target_identifier": str(self.sentry_app.id),
                "sentry_app_identifier": "sentry_app_id",
            },
        )

    def test_migration(self) -> None:
        self.sentry_app_id_action.refresh_from_db()
        assert self.sentry_app_id_action.config.get("target_type") == ActionTarget.SENTRY_APP
        assert self.sentry_app_id_action.config.get("target_identifier") == str(self.sentry_app.id)
        assert self.sentry_app_id_action.config.get("sentry_app_identifier") is None
