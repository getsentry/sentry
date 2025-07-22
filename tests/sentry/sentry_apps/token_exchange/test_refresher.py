from unittest.mock import PropertyMock, patch

import pytest
from django.db.utils import OperationalError

from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.apiapplication import ApiApplication
from sentry.models.apitoken import ApiToken
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.token_exchange.refresher import Refresher
from sentry.sentry_apps.token_exchange.util import SENSITIVE_CHARACTER_LIMIT
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError, SentryAppSentryError
from sentry.testutils.asserts import (
    assert_count_of_metric,
    assert_failure_metric,
    assert_halt_metric,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TestRefresher(TestCase):
    def setUp(self):
        self.install = self.create_sentry_app_installation()
        self.client_id = self.install.sentry_app.application.client_id
        self.user = self.install.sentry_app.proxy_user

        self.token = self.install.api_token

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

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_validates_token_belongs_to_sentry_app(self, mock_record):
        new_install = self.create_sentry_app_installation()
        refresh_token = new_install.api_token.refresh_token

        assert refresh_token is not None
        self.refresher.refresh_token = refresh_token

        with pytest.raises(SentryAppIntegratorError) as e:
            self.refresher.run()

        assert e.value.message == "Token does not belong to the application"
        assert e.value.webhook_context == {
            "client_id_installation_uuid": self.install.uuid,
            "client_id": self.client_id,
            "token_installation": new_install.uuid,
        }
        assert e.value.public_context == {}

        # SLO assertions
        assert_halt_metric(
            mock_record=mock_record,
            error_msg=SentryAppIntegratorError(message="Token does not belong to the application"),
        )

        # APP_CREATE (success) -> WEBHOOK_UPDATE (success) -> TOKEN_EXCHANGE (success) -> REFRESHER (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=4
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_validates_token_belongs_to_sentry_app_random_token(self, mock_record):
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
        assert e.value.webhook_context == {
            "client_id_installation_uuid": self.install.uuid,
            "client_id": self.client_id,
        }
        assert e.value.public_context == {}

        # SLO assertions
        assert_halt_metric(
            mock_record=mock_record,
            error_msg=SentryAppIntegratorError(message="Token does not belong to the application"),
        )

        # REFRESHER (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.models.ApiToken.objects.get", side_effect=ApiToken.DoesNotExist)
    def test_token_must_exist(self, _, mock_record):
        with pytest.raises(SentryAppIntegratorError) as e:
            self.refresher.run()

        assert e.value.message == "Given refresh token does not exist"
        assert e.value.webhook_context == {
            "installation_uuid": self.install.uuid,
        }
        assert e.value.public_context == {}

        # SLO assertions
        assert_halt_metric(
            mock_record=mock_record,
            error_msg=SentryAppIntegratorError(message="Given refresh token does not exist"),
        )

        # REFRESHER (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )

    @patch("sentry.sentry_apps.token_exchange.refresher.Refresher._validate")
    @patch("sentry.models.ApiApplication.objects.get", side_effect=ApiApplication.DoesNotExist)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_api_application_must_exist(self, mock_record, _, mock_validate):
        with pytest.raises(SentryAppSentryError) as e:
            self.refresher.run()

        assert e.value.message == "Could not find matching Application for given client_id"
        assert e.value.webhook_context == {
            "client_id": self.client_id,
            "installation_uuid": self.install.uuid,
        }
        assert e.value.public_context == {}

        # SLO assertions
        assert_failure_metric(
            mock_record=mock_record,
            error_msg=SentryAppSentryError(
                message="Could not find matching Application for given client_id"
            ),
        )

        # REFRESHER (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )

    @patch("sentry.sentry_apps.token_exchange.refresher.Refresher._validate")
    @patch("sentry.models.ApiApplication.sentry_app", new_callable=PropertyMock)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_sentry_app_must_exist(self, mock_record, sentry_app, validate):
        sentry_app.side_effect = SentryApp.DoesNotExist()
        with pytest.raises(SentryAppSentryError) as e:
            self.refresher.run()

        assert e.value.message == "Sentry App does not exist on attached Application"
        assert e.value.webhook_context == {
            "application_id": self.install.sentry_app.application.id,
            "installation_uuid": self.install.uuid,
            "client_id": self.client_id[:SENSITIVE_CHARACTER_LIMIT],
        }
        assert e.value.public_context == {}

        # SLO assertions
        assert_failure_metric(
            mock_record=mock_record,
            error_msg=SentryAppSentryError(
                message="Sentry App does not exist on attached Application"
            ),
        )

        # REFRESHER (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )

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

    def test_returns_token_on_outbox_error(self):
        # Mock the transaction to raise OperationalError after token creation
        with patch("sentry.hybridcloud.models.outbox.OutboxBase.process_coalesced") as mock_process:
            mock_process.side_effect = OperationalError("Outbox issue")

            # The refresher should return the token even though there was an error
            token = self.refresher.run()
            assert SentryAppInstallation.objects.get(id=self.install.id).api_token == token
