from __future__ import absolute_import

from sentry.utils.compat.mock import patch

from sentry.coreapi import APIUnauthorized
from sentry.mediators.token_exchange import Validator
from sentry.models import SentryApp
from sentry.testutils import TestCase


class TestValidator(TestCase):
    def setUp(self):
        self.install = self.create_sentry_app_installation()
        self.client_id = self.install.sentry_app.application.client_id
        self.user = self.install.sentry_app.proxy_user

        self.validator = Validator(install=self.install, client_id=self.client_id, user=self.user)

    def test_happy_path(self):
        assert self.validator.call()

    def test_request_must_be_made_by_sentry_app(self):
        self.validator.user = self.create_user()

        with self.assertRaises(APIUnauthorized):
            self.validator.call()

    def test_request_user_must_own_sentry_app(self):
        self.validator.user = self.create_user(is_sentry_app=True)

        with self.assertRaises(APIUnauthorized):
            self.validator.call()

    def test_installation_belongs_to_sentry_app_with_client_id(self):
        self.validator.install = self.create_sentry_app_installation()

        with self.assertRaises(APIUnauthorized):
            self.validator.call()

    @patch("sentry.models.ApiApplication.sentry_app")
    def test_raises_when_sentry_app_cannot_be_found(self, sentry_app):
        sentry_app.side_effect = SentryApp.DoesNotExist()

        with self.assertRaises(APIUnauthorized):
            self.validator.call()

    def test_raises_with_invalid_client_id(self):
        self.validator.client_id = "123"

        with self.assertRaises(APIUnauthorized):
            self.validator.call()
