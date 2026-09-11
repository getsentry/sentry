from unittest.mock import MagicMock, call, patch

import pytest
from objectstore_client import RequestError

from sentry.objectstore import UsecaseId
from sentry.preprod.snapshots.storage import SnapshotStorage, get_snapshot_storage


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


def test_delete_raises_non_404_after_trying_both(sessions) -> None:
    primary, legacy = sessions
    primary.delete.side_effect = RequestError("boom", 500, "")
    storage = SnapshotStorage(primary, [legacy])
    with pytest.raises(RequestError):
        storage.delete("k")
    legacy.delete.assert_called_once_with("k")


@patch("sentry.preprod.snapshots.storage.get_session")
def test_factory_builds_all_sessions(mock_get_session) -> None:
    get_snapshot_storage(42, org=7)
    assert mock_get_session.call_args_list == [
        call(UsecaseId.PREPROD, 42, org=7),
        call(UsecaseId.SNAPSHOTS, 42, org=7),
    ]
