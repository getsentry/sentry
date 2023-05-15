from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from sentry.coreapi import APIUnauthorized
from sentry.mediators.token_exchange import GrantExchanger
from sentry.models import ApiApplication, ApiGrant, SentryApp, SentryAppInstallation
from sentry.services.hybrid_cloud.app import app_service
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
class TestGrantExchanger(TestCase):
    def setUp(self):
        self.orm_install = self.create_sentry_app_installation(prevent_token_exchange=True)
        self.install = app_service.get_many(filter=dict(installation_ids=[self.orm_install.id]))[0]
        self.code = self.orm_install.api_grant.code
        self.client_id = self.install.sentry_app.application.client_id
        self.user = self.orm_install.sentry_app.proxy_user

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
        other_install = self.create_sentry_app_installation(prevent_token_exchange=True)
        self.grant_exchanger.code = other_install.api_grant.code

        with pytest.raises(APIUnauthorized):
            self.grant_exchanger.call()

    def test_request_user_owns_api_grant(self):
        self.grant_exchanger.user = self.create_user()

        with pytest.raises(APIUnauthorized):
            self.grant_exchanger.call()

    def test_grant_must_be_active(self):
        self.orm_install.api_grant.update(expires_at=(datetime.utcnow() - timedelta(hours=1)))

        with pytest.raises(APIUnauthorized):
            self.grant_exchanger.call()

    def test_grant_must_exist(self):
        self.grant_exchanger.code = "123"

        with pytest.raises(APIUnauthorized):
            self.grant_exchanger.call()

    @patch("sentry.models.ApiGrant.application", side_effect=ApiApplication.DoesNotExist)
    def test_application_must_exist(self, _):
        with pytest.raises(APIUnauthorized):
            self.grant_exchanger.call()

    @patch("sentry.models.ApiApplication.sentry_app", side_effect=SentryApp.DoesNotExist)
    def test_sentry_app_must_exist(self, _):
        with pytest.raises(APIUnauthorized):
            self.grant_exchanger.call()

    def test_deletes_grant_on_successful_exchange(self):
        grant_id = self.orm_install.api_grant_id
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
