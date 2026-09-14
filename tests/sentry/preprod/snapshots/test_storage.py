from unittest.mock import MagicMock, call, patch

import pytest
from objectstore_client import RequestError
from urllib3.exceptions import HTTPError

from sentry.objectstore import UsecaseId
from sentry.preprod.snapshots.storage import SnapshotStorage, get_snapshot_storage


@pytest.fixture
def sessions() -> tuple[MagicMock, MagicMock]:
    return MagicMock(name="primary"), MagicMock(name="fallback")


@patch("sentry.preprod.snapshots.storage.logger")
def test_get_prefers_primary(mock_logger, sessions) -> None:
    primary, fallback = sessions
    storage = SnapshotStorage(primary, fallback)
    assert storage.get("k") is primary.get.return_value
    fallback.get.assert_not_called()
    mock_logger.info.assert_not_called()


def test_get_uses_fallback_when_primary_missing(sessions) -> None:
    primary, fallback = sessions
    primary.get.return_value = None
    storage = SnapshotStorage(primary, fallback)
    assert storage.get("k") is fallback.get.return_value
    fallback.get.assert_called_once_with("k")


@patch("sentry.preprod.snapshots.storage.logger")
def test_get_error_propagates_without_fallback(mock_logger, sessions) -> None:
    primary, fallback = sessions
    primary.get.side_effect = RequestError("boom", 500, "")
    storage = SnapshotStorage(primary, fallback)
    with pytest.raises(RequestError):
        storage.get("k")
    fallback.get.assert_not_called()
    mock_logger.info.assert_not_called()


def test_head_uses_fallback_when_primary_missing(sessions) -> None:
    primary, fallback = sessions
    primary.head.return_value = None
    storage = SnapshotStorage(primary, fallback)
    assert storage.head("k") is fallback.head.return_value


def test_put_only_writes_primary(sessions) -> None:
    primary, fallback = sessions
    storage = SnapshotStorage(primary, fallback)
    storage.put(b"data", key="k", content_type="image/png")
    primary.put.assert_called_once_with(b"data", key="k", content_type="image/png")
    fallback.put.assert_not_called()


def test_delete_removes_from_both(sessions) -> None:
    primary, fallback = sessions
    storage = SnapshotStorage(primary, fallback)
    storage.delete("k")
    primary.delete.assert_called_once_with("k")
    fallback.delete.assert_called_once_with("k")


def test_delete_ignores_missing(sessions) -> None:
    primary, fallback = sessions
    primary.delete.side_effect = RequestError("missing", 404, "")
    storage = SnapshotStorage(primary, fallback)
    storage.delete("k")
    fallback.delete.assert_called_once_with("k")


@pytest.mark.parametrize("primary_error", [RequestError("primary", 500, ""), HTTPError("primary")])
def test_delete_raises_first_non_404_after_trying_both(
    sessions, primary_error: RequestError | HTTPError
) -> None:
    primary, fallback = sessions
    primary.delete.side_effect = primary_error
    fallback.delete.side_effect = RequestError("fallback", 503, "")
    storage = SnapshotStorage(primary, fallback)
    with pytest.raises(type(primary_error), match="primary"):
        storage.delete("k")
    fallback.delete.assert_called_once_with("k")


@pytest.mark.parametrize("operation", ["get", "head"])
@pytest.mark.parametrize("found", [True, False])
@patch("sentry.preprod.snapshots.storage.logger")
@patch("sentry.preprod.snapshots.storage.metrics")
def test_fallback_records_metric_and_log(
    mock_metrics, mock_logger, sessions, operation: str, found: bool
) -> None:
    primary, fallback = sessions
    getattr(primary, operation).return_value = None
    getattr(fallback, operation).return_value = MagicMock() if found else None
    getattr(SnapshotStorage(primary, fallback), operation)("k")
    mock_metrics.incr.assert_called_once_with(
        "preprod.snapshot_storage.legacy_fallback",
        tags={"op": operation, "found": str(found).lower()},
    )
    mock_logger.info.assert_called_once_with(
        "preprod.objectstore.fallback",
        extra={"image_type": "preprod_snapshots", "operation": operation, "found": found},
    )


@patch("sentry.preprod.snapshots.storage.get_session")
def test_factory_builds_all_sessions(mock_get_session) -> None:
    get_snapshot_storage(42, org=7)
    assert mock_get_session.call_args_list == [
        call(UsecaseId.PREPROD, 42, org=7),
        call(UsecaseId.PREPROD_SNAPSHOTS, 42, org=7),
    ]
