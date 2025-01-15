from unittest.mock import PropertyMock, patch

import pytest

from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.token_exchange.validator import Validator
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError, SentryAppSentryError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TestValidator(TestCase):
    def setUp(self):
        self.install = self.create_sentry_app_installation()
        self.client_id = self.install.sentry_app.application.client_id
        self.user = self.install.sentry_app.proxy_user
        install = app_service.get_many(filter=dict(installation_ids=[self.install.id]))[0]
        self.validator = Validator(
            install=install,
            client_id=self.client_id,
            user=self.user,
        )

    def test_happy_path(self):
        assert self.validator.run()

    def test_request_must_be_made_by_sentry_app(self):
        self.validator.user = self.create_user()

        with pytest.raises(SentryAppIntegratorError) as e:
            self.validator.run()
        assert e.value.message == "User is not a Sentry App(custom integration)"
        assert e.value.webhook_context == {
            "user": self.validator.user.name,
        }
        assert e.value.public_context == {}

    def test_request_user_must_own_sentry_app(self):
        self.validator.user = self.create_user(is_sentry_app=True)

        with pytest.raises(SentryAppIntegratorError) as e:
            self.validator.run()

        assert e.value.message == "Integration does not belong to given user"
        assert e.value.webhook_context == {
            "user": self.user.name,
            "integration": self.install.sentry_app.slug,
        }
        assert e.value.public_context == {}

    def test_installation_belongs_to_sentry_app_with_client_id(self):
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
    def test_raises_when_sentry_app_cannot_be_found(self, sentry_app):
        sentry_app.side_effect = SentryApp.DoesNotExist()

        with pytest.raises(SentryAppSentryError) as e:
            self.validator.run()
        assert e.value.message == "Integration does not exist"
        assert e.value.webhook_context == {"application_id": self.install.sentry_app.application.id}
        assert e.value.public_context == {}

    def test_raises_with_invalid_client_id(self):
        self.validator.client_id = "123"

        with pytest.raises(SentryAppSentryError) as e:
            self.validator.run()
        assert e.value.message == "Application does not exist"
        assert e.value.webhook_context == {"client_id": self.validator.client_id[:4]}
        assert e.value.public_context == {}
