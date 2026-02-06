from django.db import connections
from django.db.migrations.executor import MigrationExecutor

from sentry.notifications.models.notificationaction import ActionTarget
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestMigrations
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
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

        self.sentry_app2 = self.create_sentry_app(name="bar", organization=self.org)
        self.installation2 = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app2.slug, user=self.user
        )

        self.action_to_delete = Action.objects.create(
            type=Action.Type.SENTRY_APP,
            config={
                "target_type": ActionTarget.SENTRY_APP,
                "target_identifier": str(self.installation2.uuid),
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_INSTALLATION_UUID,
            },
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.installation2.delete()

    def validate_action(self, action: Action) -> None:
        action.refresh_from_db()
        assert action.config.get("sentry_app_identifier") == SentryAppIdentifier.SENTRY_APP_ID
        assert action.config.get("target_identifier") == str(self.sentry_app.id)
        assert action.config.get("target_type") == ActionTarget.SENTRY_APP

    def test_migration(self) -> None:
        with outbox_runner():
            pass

        self.validate_action(self.installation_uuid_action)
        self.validate_action(self.sentry_app_id_action)

        assert not Action.objects.filter(id=self.action_to_delete.id).exists()

    def test_migration_idempotent(self) -> None:
        # execute all the outbox jobs from the initial migration
        with outbox_runner():
            pass

        self.validate_action(self.installation_uuid_action)
        self.validate_action(self.sentry_app_id_action)

        # run the migration again
        conn = connections[self.connection]
        executor = MigrationExecutor(conn)
        executor.loader.build_graph()  # reload.
        migrate_to = [(self.app, self.migrate_to)]
        self._project_state_cache = executor.migrate(migrate_to, state=self._project_state_cache)  # type: ignore[assignment]

        # execute all the outbox jobs from the 2nd migration
        with outbox_runner():
            pass

        # check that everything is still as expected
        self.validate_action(self.installation_uuid_action)
        self.validate_action(self.sentry_app_id_action)
