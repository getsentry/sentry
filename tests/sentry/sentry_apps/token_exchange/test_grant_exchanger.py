import threading
import time
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, PropertyMock, patch

import pytest
from django.db import connections, router, transaction

from sentry.analytics.events.sentry_app_token_exchanged import SentryAppTokenExchangedEvent
from sentry.hybridcloud.models import ApiTokenReplica
from sentry.hybridcloud.models.outbox import ControlOutbox, OutboxDatabaseError
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.apiapplication import ApiApplication
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.token_exchange.grant_exchanger import GrantExchanger
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError, SentryAppSentryError
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.testutils.asserts import (
    assert_count_of_metric,
    assert_failure_metric,
    assert_halt_metric,
    assert_success_metric,
)
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class TestGrantExchanger(TestCase):
    def setUp(self) -> None:
        self.install = self.create_sentry_app_installation(prevent_token_exchange=True)
        grant = self.install.api_grant
        assert grant is not None
        application = self.install.sentry_app.application
        assert application is not None
        user = self.install.sentry_app.proxy_user
        assert user is not None
        self.grant = grant
        self.code = grant.code
        self.application = application
        self.client_id = application.client_id
        self.user = user

        self.grant_exchanger = GrantExchanger(
            install=self.install, client_id=self.client_id, code=self.code, user=self.user
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_happy_path(self, mock_record: MagicMock) -> None:
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
    def test_adds_token_to_installation(self, mock_record: MagicMock) -> None:
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
    def test_outbox_flush_failure_returns_token(self, mock_record: MagicMock) -> None:
        with patch.object(
            ApiToken, "handle_async_replication", side_effect=Exception("replication failed")
        ) as mock_replication:
            token = self.grant_exchanger.run()

        mock_replication.assert_called()
        assert SentryAppInstallation.objects.get(id=self.install.id).api_token == token
        assert not ApiGrant.objects.filter(id=self.install.api_grant_id).exists()
        assert ControlOutbox.objects.filter(
            category=OutboxCategory.API_TOKEN_UPDATE, object_identifier=token.id
        ).exists()
        assert_success_metric(mock_record)

        # At this point, the token change has been committed, but the outbox
        # has not been processed, so there should be no replica.
        with assume_test_silo_mode(SiloMode.CELL):
            assert not ApiTokenReplica.objects.filter(apitoken_id=token.id).exists()

        with outbox_runner():
            pass

        with assume_test_silo_mode(SiloMode.CELL):
            assert ApiTokenReplica.objects.filter(apitoken_id=token.id).exists()

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_outbox_failure_before_token_creation_allows_retry(
        self, mock_record: MagicMock
    ) -> None:
        outbox_error = OutboxDatabaseError("outbox write failed")
        with patch.object(ApiToken.objects, "create", side_effect=outbox_error):
            with pytest.raises(SentryAppSentryError) as e:
                self.grant_exchanger.run()

        assert e.value.message == "Failed to exchange given grant"
        assert e.value.status_code == 500
        assert e.value.webhook_context == {"installation_uuid": self.install.uuid}
        assert e.value.__cause__ is outbox_error

        # Assert that the token wasn't minted, so the grant is still exchangeable.
        assert ApiGrant.objects.filter(id=self.grant.id).exists()
        assert not ApiToken.objects.filter(application=self.grant.application).exists()

        assert_failure_metric(
            mock_record=mock_record,
            error_msg=SentryAppSentryError(message="Failed to exchange given grant"),
        )

        # GRANT_EXCHANGER (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )

        # Ensure we can still exchange the grant after this class of failure.
        token = GrantExchanger(
            install=self.install, client_id=self.client_id, code=self.code, user=self.user
        ).run()

        assert SentryAppInstallation.objects.get(id=self.install.id).api_token == token
        assert not ApiGrant.objects.filter(id=self.grant.id).exists()

        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=2
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )

        # Ensure the token was successfully replicated after the exchange.
        with assume_test_silo_mode(SiloMode.CELL):
            replica = ApiTokenReplica.objects.get(apitoken_id=token.id)
        assert replica.token == token.token

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_grant_must_belong_to_installations(self, mock_record: MagicMock) -> None:
        other_install = self.create_sentry_app_installation(prevent_token_exchange=True)
        other_grant = other_install.api_grant
        assert other_grant is not None
        self.grant_exchanger.code = other_grant.code

        with pytest.raises(SentryAppIntegratorError) as e:
            self.grant_exchanger.run()
        assert e.value.message == "Forbidden grant"
        assert e.value.webhook_context == {}
        assert e.value.public_context == {}

        # SLO assertions
        assert_halt_metric(
            mock_record=mock_record, error_msg=SentryAppIntegratorError(message="Forbidden grant")
        )

        # APP_CREATE (success) -> INSTALLATION_CREATE (success) -> GRANT_EXCHANGER (halt)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=3
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.HALTED, outcome_count=1
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_request_user_owns_api_grant(self, mock_record: MagicMock) -> None:
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
    def test_grant_must_be_active(self, mock_record: MagicMock) -> None:
        self.grant.update(expires_at=(datetime.now(UTC) - timedelta(hours=1)))

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
    def test_grant_must_exist(self, mock_record: MagicMock) -> None:
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
    def test_application_must_exist(
        self, application: MagicMock, validate: MagicMock, mock_record: MagicMock
    ) -> None:
        application.side_effect = ApiApplication.DoesNotExist()

        with pytest.raises(SentryAppSentryError) as e:
            self.grant_exchanger.run()
        assert e.value.message == "Could not find application from grant"
        assert e.value.webhook_context == {
            "code": self.code[:4],
            "grant_id": self.grant.id,
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
    def test_sentry_app_must_exist(self, mock_record: MagicMock, sentry_app: MagicMock) -> None:
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
    def test_deletes_grant_on_successful_exchange(self, mock_record: MagicMock) -> None:
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
    def test_race_condition_on_grant_exchange(self, mock_record: MagicMock) -> None:
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

    def test_second_exchange_with_stale_grant_fails(self) -> None:
        # The second request reads the grant before the first request deletes it.
        second_exchanger = GrantExchanger(
            install=self.install, client_id=self.client_id, code=self.code, user=self.user
        )
        assert second_exchanger.grant.id == self.install.api_grant_id

        token = self.grant_exchanger.run()

        with pytest.raises(SentryAppIntegratorError) as e:
            second_exchanger.run()
        assert e.value.message == "Could not find grant for given code"
        assert e.value.status_code == 401
        assert ApiToken.objects.filter(application=token.application).count() == 1

    @patch("sentry.analytics.record")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_records_analytics(self, mock_record: MagicMock, record: MagicMock) -> None:
        GrantExchanger(
            install=self.install, client_id=self.client_id, code=self.code, user=self.user
        ).run()

        assert_last_analytics_event(
            record,
            SentryAppTokenExchangedEvent(
                sentry_app_installation_id=self.install.id,
                exchange_type="authorization",
            ),
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


@control_silo_test
class TestGrantExchangerConcurrentExchange(TransactionTestCase):
    def test_exchange_fails_when_other_exchange_commits_after_lock_expires(self) -> None:
        install = self.create_sentry_app_installation(prevent_token_exchange=True)
        assert install.api_grant is not None
        assert install.sentry_app.application is not None
        assert install.sentry_app.proxy_user is not None
        grant_id = install.api_grant.id
        exchanger = GrantExchanger(
            install=install,
            code=install.api_grant.code,
            client_id=install.sentry_app.application.client_id,
            user=install.sentry_app.proxy_user,
        )

        using = router.db_for_write(ApiGrant)
        with connections[using].cursor() as cursor:
            cursor.execute("SELECT pg_backend_pid()")
            exchanger_pid = cursor.fetchone()[0]

        grant_deleted = threading.Event()
        exchanger_blocked = threading.Event()

        # The other request deleted the grant but did not commit yet. It does not hold the
        # Redis lock, as if its lock expired, so our exchange can take the lock and still
        # see the grant.
        def other_exchange() -> None:
            try:
                with transaction.atomic(using=using), unguarded_write(using=using):
                    ApiGrant.objects.filter(id=grant_id).delete()
                    grant_deleted.set()

                    # Commit only when our exchange waits for the rows this transaction holds.
                    deadline = time.monotonic() + 30
                    while time.monotonic() < deadline:
                        with connections[using].cursor() as cursor:
                            cursor.execute(
                                "SELECT cardinality(pg_blocking_pids(%s)) > 0", [exchanger_pid]
                            )
                            if cursor.fetchone()[0]:
                                exchanger_blocked.set()
                                break
                        time.sleep(0.01)
            finally:
                connections[using].close()

        thread = threading.Thread(target=other_exchange)
        thread.start()
        try:
            assert grant_deleted.wait(30)
            with pytest.raises(SentryAppIntegratorError) as e:
                exchanger.run()
        finally:
            thread.join(30)

        assert exchanger_blocked.is_set()
        assert e.value.message == "Could not find grant for given code"
        assert e.value.status_code == 401
        assert not ApiToken.objects.filter(application=install.sentry_app.application).exists()
        assert SentryAppInstallation.objects.get(id=install.id).api_token is None
