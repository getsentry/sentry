from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.typings.notification_action import SentryAppIdentifier


class TestMigrateActionsSentryAppData(TestMigrations):
    migrate_from = "0105_add_incident_identifer_index"
    migrate_to = "0106_migrate_actions_sentry_app_data"
    app = "workflow_engine"

    def setup_initial_state(self) -> None:
        self.org = self.create_organization(name="test-org")
        self.user = self.create_user()

        self.sentry_app = self.create_sentry_app(name="foo", organization=self.org)
        self.installation = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.user
        )

        self.installation_uuid_action = Action.objects.create(
            type=Action.Type.SENTRY_APP,
            config={
                "target_type": ActionTarget.SENTRY_APP,
                "target_identifier": str(self.installation.uuid),
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_INSTALLATION_UUID,
            },
        )
        self.sentry_app_id_action = Action.objects.create(
            type=Action.Type.SENTRY_APP,
            config={
                "target_type": ActionTarget.SENTRY_APP,
                "target_identifier": str(self.sentry_app.id),
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
            },
        )

    def test_migration(self) -> None:
        self.installation_uuid_action.refresh_from_db()
        assert (
            self.installation_uuid_action.config.get("sentry_app_identifier")
            == SentryAppIdentifier.SENTRY_APP_ID
        )
        assert self.installation_uuid_action.config.get("target_identifier") == str(
            self.sentry_app.id
        )
        assert self.installation_uuid_action.config.get("target_type") == ActionTarget.SENTRY_APP

        self.sentry_app_id_action.refresh_from_db()
        assert (
            self.sentry_app_id_action.config.get("sentry_app_identifier")
            == SentryAppIdentifier.SENTRY_APP_ID
        )
        assert self.sentry_app_id_action.config.get("target_identifier") == str(self.sentry_app.id)
        assert self.sentry_app_id_action.config.get("target_type") == ActionTarget.SENTRY_APP
