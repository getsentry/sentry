import pytest

from sentry import deletions
from sentry.constants import ObjectStatus
from sentry.models.apiapplication import ApiApplication
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test, create_test_regions
from sentry.users.models.user import User
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.typings.notification_action import SentryAppIdentifier


@control_silo_test(regions=create_test_regions("us", "de"))
class TestSentryAppDeletionTask(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user()
        self.org = self.create_organization()

        self.sentry_app = self.create_sentry_app(
            name="blah", organization=self.org, scopes=("project:read",)
        )

    def test_hard_deletes_app_installations(self) -> None:
        install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.user
        )
        deletions.exec_sync(self.sentry_app)
        assert not SentryAppInstallation.objects.filter(pk=install.id).exists()

    def test_deletes_api_application(self) -> None:
        application = self.sentry_app.application
        deletions.exec_sync(self.sentry_app)
        assert not ApiApplication.objects.filter(pk=application.id).exists()

    def test_deletes_proxy_user(self) -> None:
        proxy_user = self.sentry_app.proxy_user
        deletions.exec_sync(self.sentry_app)
        assert not User.objects.filter(pk=proxy_user.id).exists()

    def test_hard_deletes_sentry_app(self) -> None:
        deletions.exec_sync(self.sentry_app)

        with pytest.raises(SentryApp.DoesNotExist):
            SentryApp.objects.get(pk=self.sentry_app.id)

    def test_disables_actions(self) -> None:
        action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": str(self.sentry_app.id),
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
                "target_type": ActionTarget.SENTRY_APP,
            },
        )
        webhook_action = self.create_action(
            type=Action.Type.WEBHOOK,
            config={
                "target_identifier": self.sentry_app.slug,
            },
        )
        other_action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": "1212121212",
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
                "target_type": ActionTarget.SENTRY_APP,
            },
        )
        deletions.exec_sync(self.sentry_app)

        action.refresh_from_db()
        assert action.status == ObjectStatus.DISABLED

        webhook_action.refresh_from_db()
        assert webhook_action.status == ObjectStatus.DISABLED

        other_action.refresh_from_db()
        assert other_action.status == ObjectStatus.ACTIVE
