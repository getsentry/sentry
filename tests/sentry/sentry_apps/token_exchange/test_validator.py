from unittest.mock import MagicMock, PropertyMock, patch

import pytest

from sentry.constants import SentryAppInstallationStatus, SentryAppStatus
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.token_exchange.validator import Validator
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError, SentryAppSentryError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TestValidator(TestCase):
    def setUp(self) -> None:
        self.install = self.create_sentry_app_installation()
        application = self.install.sentry_app.application
        assert application is not None
        user = self.install.sentry_app.proxy_user
        assert user is not None
        self.application = application
        self.client_id = application.client_id
        self.user = user
        self.validator = Validator(
            install=self.install,
            client_id=self.client_id,
            user=self.user,
        )

    def test_happy_path(self) -> None:
        assert self.validator.run()

    def test_allows_pending_installation(self) -> None:
        self.install.update(status=SentryAppInstallationStatus.PENDING)

        assert self.validator.run()

    def test_rejects_deleting_app(self) -> None:
        SentryApp.objects.get(id=self.install.sentry_app_id).update(
            status=SentryAppStatus.DELETION_IN_PROGRESS
        )
        assert self.install.sentry_app.status != SentryAppStatus.DELETION_IN_PROGRESS

        with pytest.raises(SentryAppIntegratorError) as exc:
            self.validator.run()

        assert exc.value.message == "Integration is being deleted"
        assert exc.value.status_code == 401

    def test_rejects_deleting_installation_with_stale_instance(self) -> None:
        SentryAppInstallation.objects.get(id=self.install.id).update(
            status=SentryAppInstallationStatus.PENDING_DELETION
        )
        assert self.install.status != SentryAppInstallationStatus.PENDING_DELETION

        with pytest.raises(SentryAppIntegratorError) as exc:
            self.validator.run()

        assert exc.value.message == "Installation is being deleted"
        assert exc.value.status_code == 401

    def test_rejects_deleted_installation(self) -> None:
        self.install.delete()

        with pytest.raises(SentryAppIntegratorError) as exc:
            self.validator.run()

        assert exc.value.message == "Installation not found"
        assert exc.value.status_code == 401

    def test_request_must_be_made_by_sentry_app(self) -> None:
        self.validator.user = self.create_user()

        with pytest.raises(SentryAppIntegratorError) as e:
            self.validator.run()
        assert e.value.message == "User is not a Sentry App(custom integration)"
        assert e.value.webhook_context == {
            "user": self.validator.user.name,
        }
        assert e.value.public_context == {}

    def test_request_user_must_own_sentry_app(self) -> None:
        self.validator.user = self.create_user(is_sentry_app=True)

        with pytest.raises(SentryAppIntegratorError) as e:
            self.validator.run()

        assert e.value.message == "Integration does not belong to given user"
        assert e.value.webhook_context == {
            "user": self.user.name,
            "integration": self.install.sentry_app.slug,
            "installation_uuid": self.install.uuid,
        }
        assert e.value.public_context == {}

    def test_installation_belongs_to_sentry_app_with_client_id(self) -> None:
        self.validator.install = self.create_sentry_app_installation()

        with pytest.raises(SentryAppIntegratorError) as e:
            self.validator.run()
        assert (
            e.value.message
            == f"Given installation is not for integration: {self.install.sentry_app.slug}"
        )
        assert e.value.webhook_context == {"installation_uuid": self.validator.install.uuid}
        assert e.value.public_context == {}

    @patch("sentry.models.ApiApplication.sentry_app", new_callable=PropertyMock)
    def test_raises_when_sentry_app_cannot_be_found(self, sentry_app: MagicMock) -> None:
        sentry_app.side_effect = SentryApp.DoesNotExist()

        with pytest.raises(SentryAppSentryError) as e:
            self.validator.run()
        assert e.value.message == "Integration does not exist"
        assert e.value.webhook_context == {"application_id": self.application.id}
        assert e.value.public_context == {}

    def test_raises_with_invalid_client_id(self) -> None:
        self.validator.client_id = "123"

        with pytest.raises(SentryAppSentryError) as e:
            self.validator.run()
        assert e.value.message == "Application does not exist"
        assert e.value.webhook_context == {"client_id": self.validator.client_id[:4]}
        assert e.value.public_context == {}

    def test_raises_when_application_is_inactive(self) -> None:
        from sentry.models.apiapplication import ApiApplicationStatus

        self.application.status = ApiApplicationStatus.inactive
        self.application.save()

        with pytest.raises(SentryAppIntegratorError) as e:
            self.validator.run()
        assert e.value.message == "Application is not active"
        assert e.value.status_code == 401
        assert e.value.webhook_context == {
            "application_id": self.application.id,
            "client_id": self.client_id[:4],
        }
        assert e.value.public_context == {}
