from unittest.mock import patch

import pytest

from sentry.coreapi import APIUnauthorized
from sentry.mediators.token_exchange import Validator
from sentry.models import SentryApp
from sentry.services.hybrid_cloud.app import app_service
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
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
        assert self.validator.call()

    def test_request_must_be_made_by_sentry_app(self):
        self.validator.user = self.create_user()

        with pytest.raises(APIUnauthorized):
            self.validator.call()

    def test_request_user_must_own_sentry_app(self):
        self.validator.user = self.create_user(is_sentry_app=True)

        with pytest.raises(APIUnauthorized):
            self.validator.call()

    def test_installation_belongs_to_sentry_app_with_client_id(self):
        self.validator.install = self.create_sentry_app_installation()

        with pytest.raises(APIUnauthorized):
            self.validator.call()

    @patch("sentry.models.ApiApplication.sentry_app")
    def test_raises_when_sentry_app_cannot_be_found(self, sentry_app):
        sentry_app.side_effect = SentryApp.DoesNotExist()

        with pytest.raises(APIUnauthorized):
            self.validator.call()

    def test_raises_with_invalid_client_id(self):
        self.validator.client_id = "123"

        with pytest.raises(APIUnauthorized):
            self.validator.call()
