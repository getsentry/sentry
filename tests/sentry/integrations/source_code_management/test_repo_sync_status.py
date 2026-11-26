from unittest.mock import patch

from sentry.integrations.source_code_management.repo_sync_status import (
    FEATURE,
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
from sentry.organizations.services.organization import organization_service
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import control_silo_test
from sentry.utils import redis

INTEGRATION_ID = 2


class RepoSyncStatusTestCase(TestCase):
    def _status(self) -> RepoSyncStatus | None:
        return get_status(self.organization.id, INTEGRATION_ID)

    def _has_record(self) -> bool:
        key = f"scm-repo-sync:{self.organization.id}:{INTEGRATION_ID}"
        return bool(redis.redis_clusters.get("default").exists(key))


@control_silo_test
@with_feature(FEATURE)
class RepoSyncStatusTest(RepoSyncStatusTestCase):
    def test_done_once_synced_after_the_request(self) -> None:
        record_sync_requested(self.organization.id, INTEGRATION_ID, RepoSyncTrigger.INSTALL)
        assert self._status() == RepoSyncOk(state="syncing", trigger=RepoSyncTrigger.INSTALL)

        record_synced(self.organization.id, INTEGRATION_ID)
        assert self._status() == RepoSyncOk(state="done", trigger=RepoSyncTrigger.INSTALL)

    def test_syncing_until_its_batches_finish(self) -> None:
        record_sync_requested(self.organization.id, INTEGRATION_ID, RepoSyncTrigger.MANUAL)
        record_synced(self.organization.id, INTEGRATION_ID, batches=2)

        record_batch_finished(self.organization.id, INTEGRATION_ID)
        assert self._status() == RepoSyncOk(state="syncing", trigger=RepoSyncTrigger.MANUAL)

        record_batch_finished(self.organization.id, INTEGRATION_ID)
        assert self._status() == RepoSyncOk(state="done", trigger=RepoSyncTrigger.MANUAL)

    def test_a_sync_from_before_the_request_does_not_count(self) -> None:
        with freeze_time("2020-01-01 10:00:00"):
            record_sync_requested(self.organization.id, INTEGRATION_ID, RepoSyncTrigger.INSTALL)
            record_synced(self.organization.id, INTEGRATION_ID)
        with freeze_time("2020-01-01 10:00:05"):
            record_sync_requested(self.organization.id, INTEGRATION_ID, RepoSyncTrigger.WEBHOOK)

        assert self._status() == RepoSyncOk(state="syncing", trigger=RepoSyncTrigger.WEBHOOK)

    def test_failed_until_the_next_request(self) -> None:
        record_sync_requested(self.organization.id, INTEGRATION_ID, RepoSyncTrigger.INSTALL)
        record_sync_failed(self.organization.id, INTEGRATION_ID, "rate_limited")
        assert self._status() == RepoSyncFailed(
            trigger=RepoSyncTrigger.INSTALL, reason="rate_limited"
        )

        record_sync_requested(self.organization.id, INTEGRATION_ID, RepoSyncTrigger.MANUAL)
        assert self._status() == RepoSyncOk(state="syncing", trigger=RepoSyncTrigger.MANUAL)

    def test_nothing_is_written_without_a_request(self) -> None:
        # The daily sync records these steps, but nobody asked for it.
        record_synced(self.organization.id, INTEGRATION_ID, batches=1)
        record_batch_finished(self.organization.id, INTEGRATION_ID)
        record_sync_failed(self.organization.id, INTEGRATION_ID, "rate_limited")

        assert self._status() is None
        assert not self._has_record()

    def test_record_expires(self) -> None:
        record_sync_requested(self.organization.id, INTEGRATION_ID, RepoSyncTrigger.INSTALL)

        key = f"scm-repo-sync:{self.organization.id}:{INTEGRATION_ID}"
        assert 0 < redis.redis_clusters.get("default").ttl(key) <= RECORD_TTL_SECONDS

    def test_redis_errors_are_logged_not_raised(self) -> None:
        # Make the organization first: making it uses Redis too.
        organization_id = self.organization.id
        with patch.object(redis.redis_clusters, "get", side_effect=ConnectionError):
            record_sync_requested(organization_id, INTEGRATION_ID, RepoSyncTrigger.INSTALL)
            record_synced(organization_id, INTEGRATION_ID)
            assert get_status(organization_id, INTEGRATION_ID) is None

    def test_feature_check_errors_are_logged_not_raised(self) -> None:
        with patch.object(organization_service, "get_org_by_id", side_effect=ConnectionError):
            record_sync_requested(self.organization.id, INTEGRATION_ID, RepoSyncTrigger.INSTALL)

        assert not self._has_record()


@control_silo_test
class RepoSyncStatusWithoutFeatureTest(RepoSyncStatusTestCase):
    def test_nothing_is_written(self) -> None:
        record_sync_requested(self.organization.id, INTEGRATION_ID, RepoSyncTrigger.INSTALL)
        record_synced(self.organization.id, INTEGRATION_ID, batches=1)

        assert self._status() is None
        assert not self._has_record()
