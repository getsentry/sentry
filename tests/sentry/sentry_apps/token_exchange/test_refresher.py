from unittest.mock import patch

import pytest

from sentry.models.apiapplication import ApiApplication
from sentry.models.apitoken import ApiToken
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.token_exchange.refresher import Refresher
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TestRefresher(TestCase):
    def setUp(self):
        self.orm_install = self.create_sentry_app_installation()
        self.client_id = self.orm_install.sentry_app.application.client_id
        self.user = self.orm_install.sentry_app.proxy_user

        self.token = self.orm_install.api_token

        self.install = app_service.get_many(filter=dict(installation_ids=[self.orm_install.id]))[0]

        self.refresher = Refresher(
            install=self.install,
            client_id=self.client_id,
            refresh_token=self.token.refresh_token,
            user=self.user,
        )

    def test_happy_path(self):
        assert self.refresher.run()

    def test_adds_token_to_installation(self):
        token = self.refresher.run()
        assert SentryAppInstallation.objects.get(id=self.install.id).api_token == token

    def test_deletes_refreshed_token(self):
        self.refresher.run()
        assert not ApiToken.objects.filter(id=self.token.id).exists()

    def test_validates_token_belongs_to_sentry_app(self):
        refresh_token = ApiToken.objects.create(
            user=self.user,
            application=ApiApplication.objects.create(owner_id=self.create_user().id),
        ).refresh_token
        assert refresh_token is not None
        self.refresher.refresh_token = refresh_token

        with pytest.raises(SentryAppIntegratorError):
            self.refresher.run()

    @patch("sentry.models.ApiToken.objects.get", side_effect=ApiToken.DoesNotExist)
    def test_token_must_exist(self, _):
        with pytest.raises(SentryAppIntegratorError):
            self.refresher.run()

    @patch("sentry.models.ApiApplication.objects.get", side_effect=ApiApplication.DoesNotExist)
    def test_api_application_must_exist(self, _):
        with pytest.raises(SentryAppIntegratorError):
            self.refresher.run()

    @patch("sentry.models.ApiApplication.sentry_app", side_effect=SentryApp.DoesNotExist)
    def test_sentry_app_must_exist(self, _):
        with pytest.raises(SentryAppIntegratorError):
            self.refresher.run()

    @patch("sentry.analytics.record")
    def test_records_analytics(self, record):
        Refresher(
            install=self.install,
            client_id=self.client_id,
            refresh_token=self.token.refresh_token,
            user=self.user,
        ).run()

        record.assert_called_with(
            "sentry_app.token_exchanged",
            sentry_app_installation_id=self.install.id,
            exchange_type="refresh",
        )
