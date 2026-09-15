from unittest.mock import MagicMock, call, patch

import pytest
import urllib3
from django.test import override_settings
from objectstore_client import RequestError
from urllib3.exceptions import HTTPError

from sentry.objectstore import UsecaseId, get_session
from sentry.preprod.snapshots.storage import SnapshotStorage, get_snapshot_storage
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all


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


@django_db_all
@patch("sentry.preprod.snapshots.storage.get_session")
def test_factory_defaults_to_preprod_primary(mock_get_session) -> None:
    get_snapshot_storage(42, org=7)
    assert mock_get_session.call_args_list == [
        call(UsecaseId.PREPROD, 42, org=7, socket_timeout=None),
        call(UsecaseId.PREPROD_SNAPSHOTS, 42, org=7, socket_timeout=None),
    ]


@django_db_all
@pytest.mark.parametrize("socket_timeout", [None, urllib3.Timeout(connect=5.0, read=30.0)])
@patch("sentry.preprod.snapshots.storage.get_session")
def test_factory_follows_option(mock_get_session, socket_timeout) -> None:
    with override_options({"preprod.snapshots.objectstore.snapshots-usecase.enabled": True}):
        get_snapshot_storage(42, org=7, socket_timeout=socket_timeout)
    assert mock_get_session.call_args_list == [
        call(UsecaseId.PREPROD_SNAPSHOTS, 42, org=7, socket_timeout=socket_timeout),
        call(UsecaseId.PREPROD, 42, org=7, socket_timeout=socket_timeout),
    ]


@django_db_all
def test_factory_socket_timeout_does_not_change_shared_client_or_config() -> None:
    shared_timeout = urllib3.Timeout(connect=2.0, read=None)
    connection_kwargs = {"timeout": shared_timeout, "maxsize": 16}
    socket_timeout = urllib3.Timeout(connect=5.0, read=30.0)
    with (
        override_settings(
            SENTRY_OBJECTSTORE_CONFIG={
                "base_url": "http://objectstore",
                "connection_kwargs": connection_kwargs,
                "retries": 2,
            }
        ),
        patch("sentry.objectstore.Client") as client,
        patch("sentry.objectstore._get_client") as get_shared_client,
    ):
        get_snapshot_storage(42, org=7, socket_timeout=socket_timeout)
        get_shared_client.assert_not_called()
        get_session(UsecaseId.PREPROD, 42, org=7)

    assert client.call_count == 2
    for create_call in client.call_args_list:
        assert create_call.kwargs["connection_kwargs"] == {
            "timeout": socket_timeout,
            "maxsize": 16,
        }
        assert create_call.kwargs["retries"] == 2
    assert connection_kwargs == {"timeout": shared_timeout, "maxsize": 16}
    get_shared_client.assert_called_once_with()
