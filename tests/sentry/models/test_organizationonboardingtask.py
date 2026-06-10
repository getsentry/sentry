from unittest.mock import patch

import pytest
from django.core.cache import cache
from django.db import connections, router
from django.test.utils import CaptureQueriesContext

from sentry.models.organizationonboardingtask import (
    OnboardingTask,
    OnboardingTaskStatus,
    OrganizationOnboardingTask,
)
from sentry.testutils.cases import TestCase


class OrganizationOnboardingTaskRecordTest(TestCase):
    _TASK = OnboardingTask.SOURCEMAPS

    def _cache_key(self) -> str:
        # Must match the key format in record().
        return f"organizationonboardingtask:{self.organization.id}:{self._TASK}"

    def _clear_marker(self) -> None:
        cache.delete(self._cache_key())

    def test_creates_task_when_row_missing(self) -> None:
        """Cold start"""
        self._clear_marker()
        created = OrganizationOnboardingTask.objects.record(
            organization_id=self.organization.id,
            task=self._TASK,
        )
        assert created is True
        row = OrganizationOnboardingTask.objects.get(
            organization_id=self.organization.id,
            task=self._TASK,
        )
        assert row.status == OnboardingTaskStatus.COMPLETE
        assert cache.get(self._cache_key()) is not None

    def test_cache_hit_makes_no_database_access(self) -> None:
        """Warm cache: record() must return False before touching the ORM"""
        cache.set(self._cache_key(), 1, 60)
        with (
            patch.object(
                OrganizationOnboardingTask.objects, "update_or_create"
            ) as mock_update_or_create,
            patch.object(OrganizationOnboardingTask.objects, "filter") as mock_filter,
        ):
            created = OrganizationOnboardingTask.objects.record(
                organization_id=self.organization.id,
                task=self._TASK,
            )
            assert created is False
            mock_update_or_create.assert_not_called()
            mock_filter.assert_not_called()

    def test_already_complete_row_short_circuits_locking_write(self) -> None:
        """Cache miss with existing COMPLETE row - no write, cache key set."""
        OrganizationOnboardingTask.objects.create(
            organization=self.organization,
            task=self._TASK,
            status=OnboardingTaskStatus.COMPLETE,
        )
        self._clear_marker()

        with patch.object(
            OrganizationOnboardingTask.objects, "update_or_create"
        ) as mock_update_or_create:
            created = OrganizationOnboardingTask.objects.record(
                organization_id=self.organization.id,
                task=self._TASK,
            )
            assert created is False
            mock_update_or_create.assert_not_called()
            assert cache.get(self._cache_key()) is not None

    def test_marker_eviction_after_record_does_not_lock_again(self) -> None:
        """Task recorded once, marker later evicted, record() must not re-enter the write path."""
        self._clear_marker()
        created = OrganizationOnboardingTask.objects.record(
            organization_id=self.organization.id,
            task=self._TASK,
        )
        assert created is True
        cache.delete(self._cache_key())

        with CaptureQueriesContext(
            connections[router.db_for_read(OrganizationOnboardingTask)]
        ) as queries:
            created = OrganizationOnboardingTask.objects.record(
                organization_id=self.organization.id,
                task=self._TASK,
            )

        assert created is False
        assert not any("FOR UPDATE" in q["sql"] for q in queries.captured_queries)

    def test_skipped_row_is_updated_to_complete(self) -> None:
        """SKIPPED must still fall through to the write path and flip to COMPLETE."""
        row = OrganizationOnboardingTask.objects.create(
            organization=self.organization,
            task=self._TASK,
            status=OnboardingTaskStatus.SKIPPED,
        )
        self._clear_marker()
        created = OrganizationOnboardingTask.objects.record(
            organization_id=self.organization.id,
            task=self._TASK,
        )
        assert created is False
        row.refresh_from_db()
        assert row.status == OnboardingTaskStatus.COMPLETE

    def test_rejects_non_complete_status(self) -> None:
        """record() only accepts status=COMPLETE."""
        with pytest.raises(ValueError, match="unsupported"):
            OrganizationOnboardingTask.objects.record(
                organization_id=self.organization.id,
                task=self._TASK,
                status=OnboardingTaskStatus.SKIPPED,
            )
