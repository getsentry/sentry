from unittest.mock import PropertyMock, patch

import pytest

from sentry.models.apiapplication import ApiApplication
from sentry.models.apitoken import ApiToken
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.token_exchange.refresher import Refresher
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError, SentryAppSentryError
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
        new_application = ApiApplication.objects.create(owner_id=self.create_user().id)
        refresh_token = ApiToken.objects.create(
            user=self.user,
            application=new_application,
        ).refresh_token
        assert refresh_token is not None
        self.refresher.refresh_token = refresh_token

        with pytest.raises(SentryAppIntegratorError) as e:
            self.refresher.run()

        assert e.value.message == "Token does not belong to the application"
        assert e.value.extras == {
            "webhook_context": {
                "client_id_from_token": new_application.client_id[:4],
                "given_client_id": self.client_id[:4],
            }
        }

    @patch("sentry.models.ApiToken.objects.get", side_effect=ApiToken.DoesNotExist)
    def test_token_must_exist(self, _):
        with pytest.raises(SentryAppIntegratorError) as e:
            self.refresher.run()

        assert e.value.message == "Given refresh token does not exist"
        assert e.value.extras == {
            "webhook_context": {
                "token": self.token.refresh_token[:4],
                "installation_uuid": self.install.uuid,
            }
        }

    @patch("sentry.models.ApiApplication.objects.get", side_effect=ApiApplication.DoesNotExist)
    def test_api_application_must_exist(self, _):
        with pytest.raises(SentryAppIntegratorError) as e:
            self.refresher.run()

        assert e.value.message == "Could not find matching Application for given client_id"
        assert e.value.extras == {
            "webhook_context": {
                "client_id": self.client_id[:4],
                "installation_uuid": self.install.uuid,
            }
        }

    @patch("sentry.sentry_apps.token_exchange.refresher.Refresher._validate")
    @patch("sentry.models.ApiApplication.sentry_app", new_callable=PropertyMock)
    def test_sentry_app_must_exist(self, sentry_app, validate):
        sentry_app.side_effect = SentryApp.DoesNotExist()
        with pytest.raises(SentryAppSentryError) as e:
            self.refresher.run()

        assert e.value.message == "Sentry App does not exist on attached Application"
        assert e.value.extras == {
            "webhook_context": {
                "application_id": self.orm_install.sentry_app.application.id,
                "installation_uuid": self.install.uuid,
            }
        }

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
