from datetime import datetime, timezone
from unittest.mock import patch

from django.core.cache import cache

from sentry.data_secrecy.cache import EffectiveGrantStatusCache, effective_grant_status_cache
from sentry.data_secrecy.types import CACHE_KEY_PATTERN, EffectiveGrantStatus, GrantCacheStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time


class EffectiveGrantStatusCacheTest(TestCase):
    def setUp(self) -> None:
        self.organization_id = 123
        self.cache_key = CACHE_KEY_PATTERN.format(organization_id=self.organization_id)
        self.current_time = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        self.access_start = datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
        self.access_end = datetime(2025, 1, 1, 14, 0, 0, tzinfo=timezone.utc)

        # Clear cache before each test
        cache.clear()

    def test_get_with_cache_miss(self) -> None:
        result = EffectiveGrantStatusCache.get(self.organization_id)

        assert result.cache_status == GrantCacheStatus.CACHE_MISS
        assert result.access_end is None
        assert result.access_start is None

    def test_get_with_negative_cache_object(self) -> None:
        # Store an EffectiveGrantStatus object with negative cache status
        cached_object = EffectiveGrantStatus(cache_status=GrantCacheStatus.NEGATIVE_CACHE)
        cache.set(self.cache_key, cached_object, timeout=300)

        result = EffectiveGrantStatusCache.get(self.organization_id)

        assert result.cache_status == GrantCacheStatus.NEGATIVE_CACHE
        assert result.access_end is None
        assert result.access_start is None

    @freeze_time("2025-01-01 12:00:00")
    def test_get_with_valid_cached_object(self) -> None:
        # Store an EffectiveGrantStatus object with valid grant
        cached_object = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.VALID_WINDOW,
            access_start=self.access_start,
            access_end=self.access_end,
        )
        cache.set(self.cache_key, cached_object, timeout=300)

        result = EffectiveGrantStatusCache.get(self.organization_id)

        assert result.cache_status == GrantCacheStatus.VALID_WINDOW
        assert result.access_end == self.access_end
        assert result.access_start == self.access_start

    @freeze_time("2025-01-01 12:00:00")
    def test_get_with_expired_cached_object(self) -> None:
        expired_access_end = datetime(2025, 1, 1, 11, 0, 0, tzinfo=timezone.utc)
        # Store an EffectiveGrantStatus object with expired grant
        cached_object = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.VALID_WINDOW,
            access_start=self.access_start,
            access_end=expired_access_end,
        )
        cache.set(self.cache_key, cached_object, timeout=300)

        result = EffectiveGrantStatusCache.get(self.organization_id)

        assert result.cache_status == GrantCacheStatus.EXPIRED_WINDOW
        assert result.access_end is None
        assert result.access_start is None

    def test_set_with_valid_grant_status(self) -> None:
        grant_status = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.VALID_WINDOW,
            access_end=self.access_end,
            access_start=self.access_start,
        )

        with patch.object(cache, "set") as mock_cache_set:
            EffectiveGrantStatusCache.set(self.organization_id, grant_status, self.current_time)

            expected_ttl = int((self.access_end - self.current_time).total_seconds())

            mock_cache_set.assert_called_once_with(
                self.cache_key, grant_status, timeout=expected_ttl
            )

    def test_set_with_negative_cache_status(self) -> None:
        grant_status = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.NEGATIVE_CACHE,
        )

        with patch.object(cache, "set") as mock_cache_set:
            EffectiveGrantStatusCache.set(self.organization_id, grant_status, self.current_time)

            mock_cache_set.assert_called_once_with(
                self.cache_key, grant_status, timeout=120  # NEGATIVE_CACHE_TTL
            )

    @freeze_time("2025-01-01 12:00:00")
    def test_set_integration_with_get(self) -> None:
        grant_status = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.VALID_WINDOW,
            access_end=self.access_end,
            access_start=self.access_start,
        )

        # Set the cache
        EffectiveGrantStatusCache.set(self.organization_id, grant_status, self.current_time)

        # Get from cache and verify
        result = EffectiveGrantStatusCache.get(self.organization_id)

        assert result.cache_status == GrantCacheStatus.VALID_WINDOW
        assert result.access_end == self.access_end
        assert result.access_start == self.access_start

    def test_set_negative_cache_integration_with_get(self) -> None:
        grant_status = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.NEGATIVE_CACHE,
        )

        # Set the cache
        EffectiveGrantStatusCache.set(self.organization_id, grant_status, self.current_time)

        # Get from cache and verify
        result = EffectiveGrantStatusCache.get(self.organization_id)

        assert result.cache_status == GrantCacheStatus.NEGATIVE_CACHE
        assert result.access_end is None
        assert result.access_start is None

    def test_delete(self) -> None:
        # First set something in cache
        grant_status = EffectiveGrantStatus(cache_status=GrantCacheStatus.NEGATIVE_CACHE)
        cache.set(self.cache_key, grant_status, timeout=300)
        assert cache.get(self.cache_key) is not None

        # Delete it
        EffectiveGrantStatusCache.delete(self.organization_id)

        # Verify it's gone
        assert cache.get(self.cache_key) is None

    def test_delete_with_nonexistent_entry(self) -> None:
        # Ensure cache is empty
        assert cache.get(self.cache_key) is None

        # Delete should not raise an error
        EffectiveGrantStatusCache.delete(self.organization_id)

        # Still should be empty
        assert cache.get(self.cache_key) is None

    def test_cache_key_format(self) -> None:
        organization_id = 456
        expected_key = f"data_access_grant:effective_grant_status:{organization_id}"

        with patch.object(cache, "get") as mock_cache_get:
            mock_cache_get.return_value = None  # Return None instead of MagicMock
            EffectiveGrantStatusCache.get(organization_id)
            mock_cache_get.assert_called_once_with(expected_key)

    def test_singleton_instance(self) -> None:
        assert isinstance(effective_grant_status_cache, EffectiveGrantStatusCache)

    @freeze_time("2025-01-01 12:00:00")
    def test_get_different_organization_ids(self) -> None:
        org_id_1 = 123
        org_id_2 = 456

        # Set data for first org
        grant_status_1 = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.VALID_WINDOW,
            access_end=self.access_end,
            access_start=self.access_start,
        )
        EffectiveGrantStatusCache.set(org_id_1, grant_status_1, self.current_time)

        # Set different data for second org
        grant_status_2 = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.NEGATIVE_CACHE,
        )
        EffectiveGrantStatusCache.set(org_id_2, grant_status_2, self.current_time)

        # Verify they have different values
        result_1 = EffectiveGrantStatusCache.get(org_id_1)
        result_2 = EffectiveGrantStatusCache.get(org_id_2)

        assert result_1.cache_status == GrantCacheStatus.VALID_WINDOW
        assert result_2.cache_status == GrantCacheStatus.NEGATIVE_CACHE
