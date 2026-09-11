from unittest.mock import Mock, call, patch

import pytest

from sentry.hybridcloud.outbox.category import OutboxCategory, _run_replication_handler
from sentry.models.authprovider import AuthProvider
from sentry.silo.base import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode, create_test_cells


@django_db_all(transaction=True)
@all_silo_test(cells=create_test_cells("us"))
@patch("sentry.hybridcloud.outbox.category.metrics")
def test_control_model_replication_records_success(mock_metrics: Mock) -> None:
    user = Factories.create_user()
    org = Factories.create_organization(owner=user)
    mock_metrics.reset_mock()

    with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
        # all_silo_test also runs under MONOLITH, where assume_test_silo_mode is a no-op.
        expected_silo = SiloMode.get_current_mode().value.lower()
        AuthProvider.objects.create(organization_id=org.id, provider="abc", config={"a": 1})

    assert mock_metrics.incr.mock_calls == [
        call(
            "hybridcloud.replication.processed",
            tags={
                "silo": expected_silo,
                "category": "AUTH_PROVIDER_UPDATE",
                "direction": "control_to_cell",
                "action": "replicate",
                "outcome": "success",
            },
            sample_rate=1.0,
        )
    ]


@patch("sentry.hybridcloud.outbox.category.metrics")
def test_run_replication_handler_records_error_and_reraises(mock_metrics: Mock) -> None:
    def failing_handler() -> None:
        raise RuntimeError("boom")

    with pytest.raises(RuntimeError, match="boom"):
        _run_replication_handler(
            OutboxCategory.TEAM_UPDATE, "cell_to_control", "delete", failing_handler
        )

    assert mock_metrics.incr.mock_calls == [
        call(
            "hybridcloud.replication.processed",
            tags={
                "silo": SiloMode.get_current_mode().value.lower(),
                "category": "TEAM_UPDATE",
                "direction": "cell_to_control",
                "action": "delete",
                "outcome": "error",
            },
            sample_rate=1.0,
        )
    ]


@patch("sentry.hybridcloud.outbox.category.metrics")
def test_run_replication_handler_times_the_handler(mock_metrics: Mock) -> None:
    _run_replication_handler(
        OutboxCategory.USER_UPDATE, "control_to_cell", "replicate", lambda: None
    )

    assert mock_metrics.timer.mock_calls[0] == call(
        "hybridcloud.replication.handler.duration",
        tags={
            "silo": SiloMode.get_current_mode().value.lower(),
            "category": "USER_UPDATE",
            "direction": "control_to_cell",
            "action": "replicate",
        },
        sample_rate=1.0,
    )


@django_db_all(transaction=True)
@all_silo_test(cells=create_test_cells("us"))
@patch("sentry.hybridcloud.outbox.category.metrics")
def test_control_model_deletion_records_delete_action(mock_metrics: Mock) -> None:
    user = Factories.create_user()
    org = Factories.create_organization(owner=user)
    with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
        auth_provider = AuthProvider.objects.create(
            organization_id=org.id, provider="abc", config={"a": 1}
        )
    mock_metrics.reset_mock()

    with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
        expected_silo = SiloMode.get_current_mode().value.lower()
        auth_provider.delete()

    assert mock_metrics.incr.mock_calls == [
        call(
            "hybridcloud.replication.processed",
            tags={
                "silo": expected_silo,
                "category": "AUTH_PROVIDER_UPDATE",
                "direction": "control_to_cell",
                "action": "delete",
                "outcome": "success",
            },
            sample_rate=1.0,
        )
    ]
