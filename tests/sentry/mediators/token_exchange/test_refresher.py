from __future__ import absolute_import

import pytz

from mock import patch
from datetime import datetime, timedelta

from sentry.coreapi import APIUnauthorized
from sentry.models import ApiApplication, ApiToken, SentryApp
from sentry.mediators.token_exchange import GrantExchanger, Refresher
from sentry.testutils import TestCase


class TestRefresher(TestCase):
    def setUp(self):
        self.install = self.create_sentry_app_installation()
        self.client_id = self.install.sentry_app.application.client_id
        self.user = self.install.sentry_app.proxy_user

        self.token = GrantExchanger.run(
            install=self.install,
            code=self.install.api_grant.code,
            client_id=self.client_id,
            user=self.user,
        )

        self.refresher = Refresher(
            install=self.install,
            client_id=self.client_id,
            refresh_token=self.token.refresh_token,
            user=self.user,
        )

    def test_happy_path(self):
        assert self.refresher.call()

    def test_expires_active_token(self):
        self.refresher.call()
        assert ApiToken.objects.get(id=self.token.id).expires_at < datetime.now(pytz.UTC)

    @patch('sentry.mediators.token_exchange.Validator.run')
    def test_validates_generic_token_exchange_requirements(self, validator):
        self.refresher.call()

        validator.assert_called_once_with(
            install=self.install,
            client_id=self.client_id,
            user=self.user,
        )

    def test_validates_token_belongs_to_sentry_app(self):
        self.refresher.refresh_token = ApiToken.objects.create(
            user=self.user,
            application=ApiApplication.objects.create(
                owner_id=self.create_user().id,
            ),
        ).refresh_token

        with self.assertRaises(APIUnauthorized):
            self.refresher.call()

    def test_cannot_exchange_expired_token(self):
        self.token.update(expires_at=(datetime.utcnow() - timedelta(hours=1)))

        with self.assertRaises(APIUnauthorized):
            self.refresher.call()

    @patch('sentry.models.ApiToken.objects.get', side_effect=ApiToken.DoesNotExist)
    def test_token_must_exist(self, _):
        with self.assertRaises(APIUnauthorized):
            self.refresher.call()

    @patch('sentry.models.ApiApplication.objects.get', side_effect=ApiApplication.DoesNotExist)
    def test_api_application_must_exist(self, _):
        with self.assertRaises(APIUnauthorized):
            self.refresher.call()

    @patch('sentry.models.ApiApplication.sentry_app', side_effect=SentryApp.DoesNotExist)
    def test_sentry_app_must_exist(self, _):
        with self.assertRaises(APIUnauthorized):
            self.refresher.call()
