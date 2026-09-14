from unittest.mock import Mock, call, patch

import pytest

from sentry.hybridcloud.models.outbox import OutboxFlushError
from sentry.hybridcloud.outbox.category import OutboxCategory, _record_replication
from sentry.models.authprovider import AuthProvider
from sentry.silo.base import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode, create_test_cells


def _tags(category: str, direction: str, **extra: str) -> dict[str, str]:
    return {
        "silo": SiloMode.get_current_mode().value.lower(),
        "category": category,
        "direction": direction,
        **extra,
    }


@django_db_all(transaction=True)
@all_silo_test(cells=create_test_cells("us"))
@patch("sentry.hybridcloud.outbox.category.metrics")
def test_control_model_replication_records_success(mock_metrics: Mock) -> None:
    user = Factories.create_user()
    org = Factories.create_organization(owner=user)
    mock_metrics.reset_mock()

    with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
        # all_silo_test also runs under MONOLITH, where assume_test_silo_mode is a no-op.
        expected = _tags(
            "AUTH_PROVIDER_UPDATE", "control_to_cell", action="replicate", outcome="success"
        )
        AuthProvider.objects.create(organization_id=org.id, provider="abc", config={"a": 1})

    assert mock_metrics.incr.mock_calls == [
        call("hybridcloud.replication.processed", tags=expected)
    ]


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
        expected = _tags(
            "AUTH_PROVIDER_UPDATE", "control_to_cell", action="delete", outcome="success"
        )
        auth_provider.delete()

    assert mock_metrics.incr.mock_calls == [
        call("hybridcloud.replication.processed", tags=expected)
    ]


@django_db_all(transaction=True)
@all_silo_test(cells=create_test_cells("us"))
@patch("sentry.hybridcloud.outbox.category.metrics")
def test_failing_tombstone_lookup_records_error_without_action(mock_metrics: Mock) -> None:
    user = Factories.create_user()
    org = Factories.create_organization(owner=user)
    with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
        auth_provider = AuthProvider.objects.create(
            organization_id=org.id, provider="abc", config={"a": 1}
        )
    mock_metrics.reset_mock()

    # maybe_process_tombstone runs before we know whether this is a replicate or a
    # delete, and makes a cross-silo RPC; a failure there must still be counted.
    with (
        assume_test_silo_mode(SiloMode.CONTROL),
        patch(
            "sentry.receivers.outbox.maybe_process_tombstone",
            side_effect=RuntimeError("tombstone rpc failed"),
        ),
        pytest.raises(OutboxFlushError),
        outbox_runner(),
    ):
        expected = _tags("AUTH_PROVIDER_UPDATE", "control_to_cell", outcome="error")
        auth_provider.delete()

    assert mock_metrics.incr.mock_calls == [
        call("hybridcloud.replication.processed", tags=expected)
    ]


@patch("sentry.hybridcloud.outbox.category.metrics")
def test_record_replication_records_error_and_reraises(mock_metrics: Mock) -> None:
    with pytest.raises(RuntimeError, match="boom"):
        with _record_replication(OutboxCategory.TEAM_UPDATE, "cell_to_control") as tags:
            tags["action"] = "delete"
            raise RuntimeError("boom")

    assert mock_metrics.incr.mock_calls == [
        call(
            "hybridcloud.replication.processed",
            tags=_tags("TEAM_UPDATE", "cell_to_control", action="delete", outcome="error"),
        )
    ]


@patch("sentry.hybridcloud.outbox.category.metrics")
def test_record_replication_times_the_block(mock_metrics: Mock) -> None:
    with _record_replication(OutboxCategory.USER_UPDATE, "control_to_cell") as tags:
        tags["action"] = "replicate"

    (timing,) = mock_metrics.timing.mock_calls
    key, duration = timing.args
    assert key == "hybridcloud.replication.handler.duration"
    assert duration >= 0
    assert timing.kwargs == {"tags": _tags("USER_UPDATE", "control_to_cell", action="replicate")}
