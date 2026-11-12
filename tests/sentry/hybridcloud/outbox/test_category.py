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


def _processed_calls(mock_incr: Mock) -> list[object]:
    # metrics.incr is shared module-wide, so ignore unrelated counters.
    return [c for c in mock_incr.mock_calls if c.args[0] == "hybridcloud.replication.processed"]


def _tags(category: str, direction: str, **extra: str) -> dict[str, str]:
    return {
        "silo": SiloMode.get_current_mode().value.lower(),
        "category": category,
        "direction": direction,
        **extra,
    }


@django_db_all(transaction=True)
@all_silo_test(cells=create_test_cells("us"))
@patch("sentry.hybridcloud.outbox.category.metrics.incr")
def test_control_model_replication_records_success(mock_incr: Mock) -> None:
    user = Factories.create_user()
    org = Factories.create_organization(owner=user)
    mock_incr.reset_mock()

    with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
        # all_silo_test also runs under MONOLITH, where assume_test_silo_mode is a no-op.
        expected = _tags(
            "AUTH_PROVIDER_UPDATE", "control_to_cell", action="replicate", result="success"
        )
        AuthProvider.objects.create(organization_id=org.id, provider="abc", config={"a": 1})

    assert _processed_calls(mock_incr) == [call("hybridcloud.replication.processed", tags=expected)]


@django_db_all(transaction=True)
@all_silo_test(cells=create_test_cells("us"))
@patch("sentry.hybridcloud.outbox.category.metrics.incr")
def test_control_model_deletion_records_delete_action(mock_incr: Mock) -> None:
    user = Factories.create_user()
    org = Factories.create_organization(owner=user)
    with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
        auth_provider = AuthProvider.objects.create(
            organization_id=org.id, provider="abc", config={"a": 1}
        )
    mock_incr.reset_mock()

    with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
        expected = _tags(
            "AUTH_PROVIDER_UPDATE", "control_to_cell", action="delete", result="success"
        )
        auth_provider.delete()

    assert _processed_calls(mock_incr) == [call("hybridcloud.replication.processed", tags=expected)]


@django_db_all(transaction=True)
@all_silo_test(cells=create_test_cells("us"))
@patch("sentry.hybridcloud.outbox.category.metrics.incr")
def test_failing_tombstone_lookup_records_failure_without_action(mock_incr: Mock) -> None:
    user = Factories.create_user()
    org = Factories.create_organization(owner=user)
    with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
        auth_provider = AuthProvider.objects.create(
            organization_id=org.id, provider="abc", config={"a": 1}
        )
    mock_incr.reset_mock()

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
        expected = _tags("AUTH_PROVIDER_UPDATE", "control_to_cell", result="failure")
        auth_provider.delete()

    assert _processed_calls(mock_incr) == [call("hybridcloud.replication.processed", tags=expected)]


@patch("sentry.hybridcloud.outbox.category.metrics.incr")
def test_record_replication_records_failure_and_reraises(mock_incr: Mock) -> None:
    with pytest.raises(RuntimeError, match="boom"):
        with _record_replication(OutboxCategory.TEAM_UPDATE, "cell_to_control") as tags:
            tags["action"] = "delete"
            raise RuntimeError("boom")

    assert mock_incr.mock_calls == [
        call(
            "hybridcloud.replication.processed",
            tags=_tags("TEAM_UPDATE", "cell_to_control", action="delete", result="failure"),
        )
    ]


@patch("sentry.utils.metrics.timing")
def test_record_replication_times_the_block(mock_timing: Mock) -> None:
    with _record_replication(OutboxCategory.USER_UPDATE, "control_to_cell") as tags:
        tags["action"] = "replicate"

    (timing,) = mock_timing.mock_calls
    key, duration, _instance, timing_tags = timing.args[:4]
    assert key == "hybridcloud.replication.handler.duration"
    assert duration >= 0
    assert timing_tags == _tags(
        "USER_UPDATE", "control_to_cell", action="replicate", result="success"
    )
