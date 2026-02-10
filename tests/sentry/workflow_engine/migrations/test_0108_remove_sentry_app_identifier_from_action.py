from django.db import connections
from django.db.migrations.executor import MigrationExecutor

from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.typings.notification_action import SentryAppIdentifier


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
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
            },
        )

    def test_migration(self) -> None:
        self.sentry_app_id_action.refresh_from_db()
        assert self.sentry_app_id_action.config.get("target_type") == ActionTarget.SENTRY_APP
        assert self.sentry_app_id_action.config.get("target_identifier") == str(self.sentry_app.id)
        assert self.sentry_app_id_action.config.get("sentry_app_identifier") is None

    def test_migration_idempotent(self) -> None:
        self.sentry_app_id_action.refresh_from_db()
        assert self.sentry_app_id_action.config.get("target_type") == ActionTarget.SENTRY_APP
        assert self.sentry_app_id_action.config.get("target_identifier") == str(self.sentry_app.id)
        assert self.sentry_app_id_action.config.get("sentry_app_identifier") is None

        # run the migration again
        conn = connections[self.connection]
        executor = MigrationExecutor(conn)
        executor.loader.build_graph()  # reload.
        migrate_to = [(self.app, self.migrate_to)]
        self._project_state_cache = executor.migrate(migrate_to, state=self._project_state_cache)  # type: ignore[assignment]

        # check that everything is still as expected
        self.sentry_app_id_action.refresh_from_db()
        assert self.sentry_app_id_action.config.get("target_type") == ActionTarget.SENTRY_APP
        assert self.sentry_app_id_action.config.get("target_identifier") == str(self.sentry_app.id)
        assert self.sentry_app_id_action.config.get("sentry_app_identifier") is None
