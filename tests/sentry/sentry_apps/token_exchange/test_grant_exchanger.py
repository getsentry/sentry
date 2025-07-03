from datetime import UTC, datetime, timedelta
from unittest.mock import PropertyMock, patch

import pytest

from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.apiapplication import ApiApplication
from sentry.models.apigrant import ApiGrant
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.token_exchange.grant_exchanger import GrantExchanger
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError, SentryAppSentryError
from sentry.testutils.asserts import (
    assert_count_of_metric,
    assert_failure_metric,
    assert_halt_metric,
    assert_success_metric,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TestGrantExchanger(TestCase):
    def setUp(self):
        self.install = self.create_sentry_app_installation(prevent_token_exchange=True)
        self.code = self.install.api_grant.code
        assert self.install.sentry_app.application is not None
        self.client_id = self.install.sentry_app.application.client_id
        self.user = self.install.sentry_app.proxy_user

        self.grant_exchanger = GrantExchanger(
            install=self.install, client_id=self.client_id, code=self.code, user=self.user
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_happy_path(self, mock_record):
        assert self.grant_exchanger.run()

        # SLO assertions
        assert_success_metric(mock_record)

        # GRANT_EXCHANGER (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_adds_token_to_installation(self, mock_record):
        token = self.grant_exchanger.run()
        assert SentryAppInstallation.objects.get(id=self.install.id).api_token == token

        # SLO assertions
        assert_success_metric(mock_record)

        # GRANT_EXCHANGER (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_grant_must_belong_to_installations(self, mock_record):
        other_install = self.create_sentry_app_installation(prevent_token_exchange=True)
        self.grant_exchanger.code = other_install.api_grant.code

        with pytest.raises(SentryAppIntegratorError) as e:
            self.grant_exchanger.run()
        assert e.value.message == "Forbidden grant"
        assert e.value.webhook_context == {}
        assert e.value.public_context == {}

        # SLO assertions
        assert_halt_metric(
            mock_record=mock_record, error_msg=SentryAppIntegratorError(message="Forbidden grant")
        )

        # APP_CREATE (success) -> GRANT_EXCHANGER (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_request_user_owns_api_grant(self, mock_record):
        self.grant_exchanger.user = self.create_user()

        with pytest.raises(SentryAppIntegratorError) as e:
            self.grant_exchanger.run()
        assert e.value.message == "User is not a Sentry App(custom integration)"
        assert e.value.webhook_context == {"user": self.grant_exchanger.user.name}
        assert e.value.public_context == {}

        # SLO assertions
        assert_halt_metric(
            mock_record=mock_record,
            error_msg=SentryAppIntegratorError(
                message="User is not a Sentry App(custom integration)"
            ),
        )

        # GRANT_EXCHANGER (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_grant_must_be_active(self, mock_record):
        self.install.api_grant.update(expires_at=(datetime.now(UTC) - timedelta(hours=1)))

        with pytest.raises(SentryAppIntegratorError) as e:
            self.grant_exchanger.run()
        assert e.value.message == "Grant has already expired"
        assert e.value.webhook_context == {}
        assert e.value.public_context == {}

        # SLO assertions
        assert_halt_metric(
            mock_record=mock_record,
            error_msg=SentryAppIntegratorError(message="Grant has already expired"),
        )

        # GRANT_EXCHANGER (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_grant_must_exist(self, mock_record):
        self.grant_exchanger.code = "123"

        with pytest.raises(SentryAppIntegratorError) as e:
            self.grant_exchanger.run()
        assert e.value.message == "Could not find grant for given code"
        assert e.value.webhook_context == {
            "code": self.grant_exchanger.code,
            "installation_uuid": self.install.uuid,
        }
        assert e.value.public_context == {}

        # SLO assertions
        assert_halt_metric(
            mock_record,
            error_msg=SentryAppIntegratorError(message="Could not find grant for given code"),
        )

        # GRANT_EXCHANGER (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.sentry_apps.token_exchange.grant_exchanger.GrantExchanger._validate")
    @patch(
        "sentry.models.ApiGrant.application",
        new_callable=PropertyMock,
    )
    def test_application_must_exist(self, application, validate, mock_record):
        application.side_effect = ApiApplication.DoesNotExist()

        with pytest.raises(SentryAppSentryError) as e:
            self.grant_exchanger.run()
        assert e.value.message == "Could not find application from grant"
        assert e.value.webhook_context == {
            "code": self.code[:4],
            "grant_id": self.install.api_grant.id,
        }
        assert e.value.public_context == {}

        # SLO assertions
        assert_failure_metric(
            mock_record=mock_record,
            error_msg=SentryAppSentryError(message="Could not find application from grant"),
        )

        # GRANT_EXCHANGER (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )

    @patch("sentry.models.ApiApplication.sentry_app", new_callable=PropertyMock)
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_sentry_app_must_exist(self, mock_record, sentry_app):
        sentry_app.side_effect = SentryApp.DoesNotExist()

        with pytest.raises(SentryAppSentryError) as e:
            self.grant_exchanger.run()
        assert e.value.message == "Integration does not exist"
        assert e.value.webhook_context == {"application_id": self.install.sentry_app.application_id}
        assert e.value.public_context == {}

        # SLO assertions
        assert_failure_metric(
            mock_record=mock_record,
            error_msg=SentryAppSentryError(message="Integration does not exist"),
        )

        # GRANT_EXCHANGER (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_deletes_grant_on_successful_exchange(self, mock_record):
        grant_id = self.install.api_grant_id
        self.grant_exchanger.run()
        assert not ApiGrant.objects.filter(id=grant_id)

        # SLO assertions
        assert_success_metric(mock_record)

        # GRANT_EXCHANGER (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_race_condition_on_grant_exchange(self, mock_record):
        from sentry.locks import locks
        from sentry.utils.locking import UnableToAcquireLock

        # simulate a race condition on the grant exchange
        grant_id = self.install.api_grant_id
        lock = locks.get(
            ApiGrant.get_lock_key(grant_id),
            duration=10,
            name="api_grant",
        )
        lock.acquire()

        with pytest.raises(UnableToAcquireLock):
            self.grant_exchanger.run()

        # GRANT_EXCHANGER (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )

    @patch("sentry.analytics.record")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_records_analytics(self, mock_record, record):
        GrantExchanger(
            install=self.install, client_id=self.client_id, code=self.code, user=self.user
        ).run()

        record.assert_called_with(
            "sentry_app.token_exchanged",
            sentry_app_installation_id=self.install.id,
            exchange_type="authorization",
        )

        # SLO assertions
        assert_success_metric(mock_record)

        # GRANT_EXCHANGER (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )
