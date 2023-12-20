from unittest.mock import patch

import pytest

from sentry.coreapi import APIUnauthorized
from sentry.mediators.token_exchange.refresher import Refresher
from sentry.models.apiapplication import ApiApplication
from sentry.models.apitoken import ApiToken
from sentry.models.integrations.sentry_app import SentryApp
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.services.hybrid_cloud.app import app_service
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
        assert self.refresher.call()

    def test_adds_token_to_installation(self):
        token = self.refresher.call()
        assert SentryAppInstallation.objects.get(id=self.install.id).api_token == token

    def test_deletes_refreshed_token(self):
        self.refresher.call()
        assert not ApiToken.objects.filter(id=self.token.id).exists()

    @patch("sentry.mediators.token_exchange.Validator.run")
    def test_validates_generic_token_exchange_requirements(self, validator):
        self.refresher.call()

        validator.assert_called_once_with(
            install=self.install, client_id=self.client_id, user=self.user
        )

    def test_validates_token_belongs_to_sentry_app(self):
        self.refresher.refresh_token = ApiToken.objects.create(
            user=self.user,
            application=ApiApplication.objects.create(owner_id=self.create_user().id),
        ).refresh_token

        with pytest.raises(APIUnauthorized):
            self.refresher.call()

    @patch("sentry.models.ApiToken.objects.get", side_effect=ApiToken.DoesNotExist)
    def test_token_must_exist(self, _):
        with pytest.raises(APIUnauthorized):
            self.refresher.call()

    @patch("sentry.models.ApiApplication.objects.get", side_effect=ApiApplication.DoesNotExist)
    def test_api_application_must_exist(self, _):
        with pytest.raises(APIUnauthorized):
            self.refresher.call()

    @patch("sentry.models.ApiApplication.sentry_app", side_effect=SentryApp.DoesNotExist)
    def test_sentry_app_must_exist(self, _):
        with pytest.raises(APIUnauthorized):
            self.refresher.call()

    @patch("sentry.analytics.record")
    def test_records_analytics(self, record):
        Refresher.run(
            install=self.install,
            client_id=self.client_id,
            refresh_token=self.token.refresh_token,
            user=self.user,
        )

        record.assert_called_with(
            "sentry_app.token_exchanged",
            sentry_app_installation_id=self.install.id,
            exchange_type="refresh",
        )
