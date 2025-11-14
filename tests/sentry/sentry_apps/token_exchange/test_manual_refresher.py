from typing import int
from unittest.mock import MagicMock, PropertyMock, patch

import pytest
from django.db.utils import OperationalError

from sentry.analytics.events.sentry_app_token_exchanged import SentryAppTokenExchangedEvent
from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.apiapplication import ApiApplication
from sentry.models.apitoken import ApiToken
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.token_exchange.manual_refresher import ManualTokenRefresher
from sentry.sentry_apps.token_exchange.util import SENSITIVE_CHARACTER_LIMIT
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError, SentryAppSentryError
from sentry.testutils.asserts import (
    assert_count_of_metric,
    assert_failure_metric,
    assert_halt_metric,
    assert_success_metric,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TestManualRefresher(TestCase):
    def setUp(self) -> None:
        self.install = self.create_sentry_app_installation()
        self.client_id = self.install.sentry_app.application.client_id
        self.user = self.install.sentry_app.proxy_user

        self.token = self.install.api_token

        self.refresher = ManualTokenRefresher(
            install=self.install,
            client_id=self.client_id,
            user=self.user,
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_happy_path(self, mock_record: MagicMock) -> None:
        token = self.refresher.run()
        assert ApiToken.objects.last() == token

        # SLO assertions
        assert_success_metric(mock_record)

        # MANUAL_REFRESHER (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_adds_token_to_installation(self, mock_record: MagicMock) -> None:
        token = self.refresher.run()
        assert SentryAppInstallation.objects.get(id=self.install.id).api_token == token

        # SLO assertions
        assert_success_metric(mock_record)

        # MANUAL_REFRESHER (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_deletes_old_token(self, mock_record: MagicMock) -> None:
        old_token_id = self.token.id
        self.refresher.run()
        assert not ApiToken.objects.filter(id=old_token_id).exists()

        # SLO assertions
        assert_success_metric(mock_record)

        # MANUAL_REFRESHER (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_installation_must_exist(self, mock_record: MagicMock) -> None:
        # Create a new installation and then delete it
        deleted_install = self.create_sentry_app_installation()
        deleted_client_id = deleted_install.sentry_app.application.client_id
        deleted_user = deleted_install.sentry_app.proxy_user
        deleted_install.delete()

        refresher = ManualTokenRefresher(
            install=deleted_install,
            client_id=deleted_client_id,
            user=deleted_user,
        )

        with pytest.raises(SentryAppIntegratorError) as e:
            refresher.run()

        assert e.value.message == "Installation not found"
        assert e.value.webhook_context == {"installation_uuid": deleted_install.uuid}
        assert e.value.public_context == {}

        # SLO assertions
        assert_halt_metric(
            mock_record=mock_record,
            error_msg=SentryAppIntegratorError(message="Installation not found"),
        )

        # APP_CREATE (success) -> WEBHOOK_UPDATE (success) -> TOKEN_EXCHANGE (success) -> MANUAL_REFRESHER (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=4
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=3
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_validates_installation_belongs_to_app(self, mock_record: MagicMock) -> None:
        # Create a different app and installation
        other_app = self.create_sentry_app(name="other-app", organization=self.organization)

        # Try to use this installation's client_id with the original install
        refresher = ManualTokenRefresher(
            install=self.install,
            client_id=other_app.application.client_id,
            user=other_app.proxy_user,
        )

        with pytest.raises(SentryAppIntegratorError) as e:
            refresher.run()

        assert e.value.message == f"Given installation is not for integration: {other_app.slug}"
        assert e.value.webhook_context == {
            "installation_uuid": self.install.uuid,
        }
        assert e.value.public_context == {}

        # SLO assertions
        assert_halt_metric(
            mock_record=mock_record,
            error_msg=SentryAppIntegratorError(
                message=f"Given installation is not for integration: {other_app.slug}"
            ),
        )

        # SENTRY_APP_CREATE (success) -> MANUAL_REFRESHER (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_validates_user_is_proxy_user(self, mock_record: MagicMock) -> None:
        wrong_user = self.create_user()

        refresher = ManualTokenRefresher(
            install=self.install,
            client_id=self.client_id,
            user=wrong_user,
        )

        with pytest.raises(SentryAppIntegratorError) as e:
            refresher.run()

        assert e.value.message == "User is not a Sentry App(custom integration)"
        assert e.value.webhook_context == {"user": wrong_user.name}
        assert e.value.public_context == {}

        # SLO assertions
        assert_halt_metric(
            mock_record=mock_record,
            error_msg=SentryAppIntegratorError(
                message="User is not a Sentry App(custom integration)"
            ),
        )

        # MANUAL_REFRESHER (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )

    @patch("sentry.sentry_apps.token_exchange.manual_refresher.ManualTokenRefresher._validate")
    @patch("sentry.models.ApiApplication.objects.get", side_effect=ApiApplication.DoesNotExist)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_api_application_must_exist(
        self, mock_record: MagicMock, _: MagicMock, mock_validate: MagicMock
    ) -> None:
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

        # MANUAL_REFRESHER (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )

    @patch("sentry.sentry_apps.token_exchange.manual_refresher.ManualTokenRefresher._validate")
    @patch("sentry.models.ApiApplication.sentry_app", new_callable=PropertyMock)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_sentry_app_must_exist(
        self, mock_record: MagicMock, sentry_app: MagicMock, validate: MagicMock
    ) -> None:
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

        # MANUAL_REFRESHER (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )

    @patch("sentry.analytics.record")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_records_analytics(self, mock_record: MagicMock, record: MagicMock) -> None:
        ManualTokenRefresher(
            install=self.install,
            client_id=self.client_id,
            user=self.user,
        ).run()

        assert_last_analytics_event(
            record,
            SentryAppTokenExchangedEvent(
                sentry_app_installation_id=self.install.id,
                exchange_type="manual_refresh",
            ),
        )

        # SLO assertions
        assert_success_metric(mock_record)

        # MANUAL_REFRESHER (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_returns_token_on_outbox_error(self, mock_record: MagicMock) -> None:
        # Mock the transaction to raise OperationalError after token creation
        with patch("sentry.hybridcloud.models.outbox.OutboxBase.process_coalesced") as mock_process:
            mock_process.side_effect = OperationalError("Outbox issue")

            # The refresher should return the token even though there was an error
            token = self.refresher.run()
            assert SentryAppInstallation.objects.get(id=self.install.id).api_token == token

        # SLO assertions
        assert_success_metric(mock_record)

        # MANUAL_REFRESHER (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_handles_installation_with_no_existing_token(self, mock_record: MagicMock) -> None:
        # Delete the existing token from the installation
        self.install.update(api_token=None)

        with pytest.raises(SentryAppIntegratorError) as e:
            self.refresher.run()

        assert e.value.message == "Installation does not have a token"
        assert e.value.status_code == 401
        assert e.value.webhook_context == {"installation_uuid": self.install.uuid}

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_new_token_has_correct_properties(self, mock_record: MagicMock) -> None:
        old_token = self.install.api_token
        new_token = self.refresher.run()

        # Verify new token has different ID and token value
        assert new_token.id != old_token.id
        assert new_token.token != old_token.token

        # Verify new token has correct properties
        assert new_token.user == self.user
        assert new_token.application == self.install.sentry_app.application
        assert new_token.scope_list == self.install.sentry_app.scope_list
        assert new_token.expires_at is not None

        # SLO assertions
        assert_success_metric(mock_record)

        # MANUAL_REFRESHER (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )
