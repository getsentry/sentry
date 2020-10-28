from __future__ import absolute_import

from sentry.utils.compat.mock import patch
from datetime import datetime, timedelta

from sentry.coreapi import APIUnauthorized
from sentry.models import ApiApplication, SentryApp, SentryAppInstallation, ApiGrant
from sentry.mediators.token_exchange import GrantExchanger
from sentry.testutils import TestCase


class TestGrantExchanger(TestCase):
    def setUp(self):
        self.install = self.create_sentry_app_installation()
        self.code = self.install.api_grant.code
        self.client_id = self.install.sentry_app.application.client_id
        self.user = self.install.sentry_app.proxy_user

        self.grant_exchanger = GrantExchanger(
            install=self.install, client_id=self.client_id, code=self.code, user=self.user
        )

    def test_happy_path(self):
        assert self.grant_exchanger.call()

    def test_adds_token_to_installation(self):
        token = self.grant_exchanger.call()
        assert SentryAppInstallation.objects.get(id=self.install.id).api_token == token

    @patch("sentry.mediators.token_exchange.Validator.run")
    def test_validate_generic_token_exchange_requirements(self, validator):
        self.grant_exchanger.call()

        validator.assert_called_once_with(
            install=self.install, client_id=self.client_id, user=self.user
        )

    def test_grant_must_belong_to_installations(self):
        other_install = self.create_sentry_app_installation()
        self.grant_exchanger.code = other_install.api_grant.code

        with self.assertRaises(APIUnauthorized):
            self.grant_exchanger.call()

    def test_request_user_owns_api_grant(self):
        self.grant_exchanger.user = self.create_user()

        with self.assertRaises(APIUnauthorized):
            self.grant_exchanger.call()

    def test_grant_must_be_active(self):
        self.install.api_grant.update(expires_at=(datetime.utcnow() - timedelta(hours=1)))

        with self.assertRaises(APIUnauthorized):
            self.grant_exchanger.call()

    def test_grant_must_exist(self):
        self.grant_exchanger.code = "123"

        with self.assertRaises(APIUnauthorized):
            self.grant_exchanger.call()

    @patch("sentry.models.ApiGrant.application", side_effect=ApiApplication.DoesNotExist)
    def test_application_must_exist(self, _):
        with self.assertRaises(APIUnauthorized):
            self.grant_exchanger.call()

    @patch("sentry.models.ApiApplication.sentry_app", side_effect=SentryApp.DoesNotExist)
    def test_sentry_app_must_exist(self, _):
        with self.assertRaises(APIUnauthorized):
            self.grant_exchanger.call()

    def test_deletes_grant_on_successful_exchange(self):
        grant_id = self.install.api_grant_id
        self.grant_exchanger.call()
        assert not ApiGrant.objects.filter(id=grant_id)

    @patch("sentry.analytics.record")
    def test_records_analytics(self, record):
        GrantExchanger.run(
            install=self.install, client_id=self.client_id, code=self.code, user=self.user
        )

        record.assert_called_with(
            "sentry_app.token_exchanged",
            sentry_app_installation_id=self.install.id,
            exchange_type="authorization",
        )
