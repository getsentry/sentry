from unittest.mock import MagicMock, call, patch

import pytest
from objectstore_client import RequestError

from sentry.objectstore import UsecaseId
from sentry.preprod.snapshots.storage import SnapshotStorage, get_snapshot_storage
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all


@pytest.fixture
def sessions() -> tuple[MagicMock, MagicMock]:
    return MagicMock(name="primary"), MagicMock(name="legacy")


def test_get_prefers_primary(sessions) -> None:
    primary, legacy = sessions
    storage = SnapshotStorage(primary, [legacy])
    assert storage.get("k") is primary.get.return_value
    legacy.get.assert_not_called()


def test_get_falls_back_to_legacy(sessions) -> None:
    primary, legacy = sessions
    primary.get.return_value = None
    storage = SnapshotStorage(primary, [legacy])
    assert storage.get("k") is legacy.get.return_value
    legacy.get.assert_called_once_with("k")


def test_get_error_propagates_without_fallback(sessions) -> None:
    primary, legacy = sessions
    primary.get.side_effect = RequestError("boom", 500, "")
    storage = SnapshotStorage(primary, [legacy])
    with pytest.raises(RequestError):
        storage.get("k")
    legacy.get.assert_not_called()


def test_head_falls_back_to_legacy(sessions) -> None:
    primary, legacy = sessions
    primary.head.return_value = None
    storage = SnapshotStorage(primary, [legacy])
    assert storage.head("k") is legacy.head.return_value


def test_put_only_writes_primary(sessions) -> None:
    primary, legacy = sessions
    storage = SnapshotStorage(primary, [legacy])
    storage.put(b"data", key="k", content_type="image/png")
    primary.put.assert_called_once_with(b"data", key="k", content_type="image/png")
    legacy.put.assert_not_called()


def test_delete_removes_from_both(sessions) -> None:
    primary, legacy = sessions
    storage = SnapshotStorage(primary, [legacy])
    storage.delete("k")
    primary.delete.assert_called_once_with("k")
    legacy.delete.assert_called_once_with("k")


def test_delete_ignores_missing(sessions) -> None:
    primary, legacy = sessions
    primary.delete.side_effect = RequestError("missing", 404, "")
    storage = SnapshotStorage(primary, [legacy])
    storage.delete("k")
    legacy.delete.assert_called_once_with("k")


def test_delete_raises_first_non_404_after_trying_both(sessions) -> None:
    primary, legacy = sessions
    primary.delete.side_effect = RequestError("primary", 500, "")
    legacy.delete.side_effect = RequestError("legacy", 503, "")
    storage = SnapshotStorage(primary, [legacy])
    with pytest.raises(RequestError, match="primary"):
        storage.delete("k")
    legacy.delete.assert_called_once_with("k")


@patch("sentry.preprod.snapshots.storage.metrics")
def test_fallback_records_metric(mock_metrics, sessions) -> None:
    primary, legacy = sessions
    primary.get.return_value = None
    legacy.get.return_value = None
    SnapshotStorage(primary, [legacy]).get("k")
    mock_metrics.incr.assert_called_once_with(
        "preprod.snapshot_storage.legacy_fallback", tags={"op": "get", "found": "false"}
    )


@django_db_all
@patch("sentry.preprod.snapshots.storage.get_session")
def test_factory_defaults_to_preprod_primary(mock_get_session) -> None:
    get_snapshot_storage(42, org=7)
    assert mock_get_session.call_args_list == [
        call(UsecaseId.PREPROD, 42, org=7),
        call(UsecaseId.SNAPSHOTS, 42, org=7),
    ]


@django_db_all
@patch("sentry.preprod.snapshots.storage.get_session")
def test_factory_follows_option(mock_get_session) -> None:
    with override_options({"preprod.snapshots.snapshots-usecase.enabled": True}):
        get_snapshot_storage(42, org=7)
    assert mock_get_session.call_args_list == [
        call(UsecaseId.SNAPSHOTS, 42, org=7),
        call(UsecaseId.PREPROD, 42, org=7),
    ]
