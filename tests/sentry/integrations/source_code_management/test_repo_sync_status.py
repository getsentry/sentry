from unittest.mock import patch

from sentry.integrations.source_code_management.repo_sync_status import (
    RECORD_TTL_SECONDS,
    RepoSyncFailed,
    RepoSyncOk,
    RepoSyncStatus,
    RepoSyncTrigger,
    get_status,
    record_batch_finished,
    record_sync_failed,
    record_sync_requested,
    record_synced,
)
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils import redis

ORGANIZATION_ID = 1
INTEGRATION_ID = 2


def _status() -> RepoSyncStatus | None:
    return get_status(ORGANIZATION_ID, INTEGRATION_ID)


def test_done_once_synced_after_the_request() -> None:
    record_sync_requested(ORGANIZATION_ID, INTEGRATION_ID, RepoSyncTrigger.INSTALL)
    assert _status() == RepoSyncOk(state="syncing", trigger=RepoSyncTrigger.INSTALL)

    record_synced(ORGANIZATION_ID, INTEGRATION_ID)
    assert _status() == RepoSyncOk(state="done", trigger=RepoSyncTrigger.INSTALL)


def test_syncing_until_its_batches_finish() -> None:
    record_sync_requested(ORGANIZATION_ID, INTEGRATION_ID, RepoSyncTrigger.MANUAL)
    record_synced(ORGANIZATION_ID, INTEGRATION_ID, batches=2)

    record_batch_finished(ORGANIZATION_ID, INTEGRATION_ID)
    assert _status() == RepoSyncOk(state="syncing", trigger=RepoSyncTrigger.MANUAL)

    record_batch_finished(ORGANIZATION_ID, INTEGRATION_ID)
    assert _status() == RepoSyncOk(state="done", trigger=RepoSyncTrigger.MANUAL)


def test_a_sync_from_before_the_request_does_not_count() -> None:
    with freeze_time("2020-01-01 10:00:00"):
        record_synced(ORGANIZATION_ID, INTEGRATION_ID)
    with freeze_time("2020-01-01 10:00:05"):
        record_sync_requested(ORGANIZATION_ID, INTEGRATION_ID, RepoSyncTrigger.WEBHOOK)

    assert _status() == RepoSyncOk(state="syncing", trigger=RepoSyncTrigger.WEBHOOK)


def test_failed_until_the_next_request() -> None:
    record_sync_requested(ORGANIZATION_ID, INTEGRATION_ID, RepoSyncTrigger.INSTALL)
    record_sync_failed(ORGANIZATION_ID, INTEGRATION_ID, "rate_limited")
    assert _status() == RepoSyncFailed(trigger=RepoSyncTrigger.INSTALL, reason="rate_limited")

    record_sync_requested(ORGANIZATION_ID, INTEGRATION_ID, RepoSyncTrigger.MANUAL)
    assert _status() == RepoSyncOk(state="syncing", trigger=RepoSyncTrigger.MANUAL)


def test_no_status_without_a_request() -> None:
    # The daily sync writes these, but nobody asked for it.
    record_synced(ORGANIZATION_ID, INTEGRATION_ID, batches=1)
    record_sync_failed(ORGANIZATION_ID, INTEGRATION_ID, "rate_limited")

    assert _status() is None


def test_record_expires() -> None:
    record_sync_requested(ORGANIZATION_ID, INTEGRATION_ID, RepoSyncTrigger.INSTALL)

    key = f"scm-repo-sync:{ORGANIZATION_ID}:{INTEGRATION_ID}"
    assert 0 < redis.redis_clusters.get("default").ttl(key) <= RECORD_TTL_SECONDS


def test_redis_errors_are_logged_not_raised() -> None:
    with patch.object(redis.redis_clusters, "get", side_effect=ConnectionError):
        record_sync_requested(ORGANIZATION_ID, INTEGRATION_ID, RepoSyncTrigger.INSTALL)
        assert _status() is None
