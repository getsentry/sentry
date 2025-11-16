from datetime import datetime, timezone

import pytest

from sentry.data_secrecy.service.model import RpcEffectiveGrantStatus
from sentry.data_secrecy.types import NEGATIVE_CACHE_TTL, EffectiveGrantStatus, GrantCacheStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time


class EffectiveGrantStatusTest(TestCase):
    def setUp(self) -> None:
        self.current_time = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        self.access_start = datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
        self.access_end = datetime(2025, 1, 1, 14, 0, 0, tzinfo=timezone.utc)
        self.expired_access_end = datetime(2025, 1, 1, 11, 0, 0, tzinfo=timezone.utc)

    def test_from_cache_with_none(self) -> None:
        """Test from_cache with None returns CACHE_MISS status"""
        result = EffectiveGrantStatus.from_cache(None)

        assert result.cache_status == GrantCacheStatus.CACHE_MISS
        assert result.access_end is None
        assert result.access_start is None

    def test_from_cache_with_negative_cache_object(self) -> None:
        """Test from_cache with negative cache object returns the same object"""
        cached_object = EffectiveGrantStatus(cache_status=GrantCacheStatus.NEGATIVE_CACHE)
        result = EffectiveGrantStatus.from_cache(cached_object)

        assert result.cache_status == GrantCacheStatus.NEGATIVE_CACHE
        assert result.access_end is None
        assert result.access_start is None
        assert result is cached_object  # Should return the same object

    @freeze_time("2025-01-01 12:00:00")
    def test_from_cache_with_expired_grant_object(self) -> None:
        """Test from_cache with expired grant object returns EXPIRED_WINDOW status"""
        cached_object = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.VALID_WINDOW,
            access_start=self.access_start,
            access_end=self.expired_access_end,  # expired
        )

        result = EffectiveGrantStatus.from_cache(cached_object)

        assert result.cache_status == GrantCacheStatus.EXPIRED_WINDOW
        assert result.access_end is None
        assert result.access_start is None

    @freeze_time("2025-01-01 12:00:00")
    def test_from_cache_with_valid_grant_object(self) -> None:
        """Test from_cache with valid grant object returns the same object"""
        cached_object = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.VALID_WINDOW,
            access_start=self.access_start,
            access_end=self.access_end,  # future time
        )

        result = EffectiveGrantStatus.from_cache(cached_object)

        assert result.cache_status == GrantCacheStatus.VALID_WINDOW
        assert result.access_end == self.access_end
        assert result.access_start == self.access_start
        assert result is cached_object  # Should return the same object

    def test_from_rpc_grant_status_with_none(self) -> None:
        """Test from_rpc_grant_status with None returns NEGATIVE_CACHE status"""
        result = EffectiveGrantStatus.from_rpc_grant_status(None, self.current_time)

        assert result.cache_status == GrantCacheStatus.NEGATIVE_CACHE
        assert result.access_end is None
        assert result.access_start is None

    def test_from_rpc_grant_status_with_expired_grant(self) -> None:
        """Test from_rpc_grant_status with expired grant returns NEGATIVE_CACHE status"""
        rpc_grant = RpcEffectiveGrantStatus(
            organization_id=1,
            access_start=self.access_start,
            access_end=self.expired_access_end,
        )

        result = EffectiveGrantStatus.from_rpc_grant_status(rpc_grant, self.current_time)

        assert result.cache_status == GrantCacheStatus.NEGATIVE_CACHE
        assert result.access_end is None
        assert result.access_start is None

    def test_from_rpc_grant_status_with_valid_grant(self) -> None:
        """Test from_rpc_grant_status with valid grant returns VALID_WINDOW status"""
        rpc_grant = RpcEffectiveGrantStatus(
            organization_id=1,
            access_start=self.access_start,
            access_end=self.access_end,
        )

        result = EffectiveGrantStatus.from_rpc_grant_status(rpc_grant, self.current_time)

        assert result.cache_status == GrantCacheStatus.VALID_WINDOW
        assert result.access_end == self.access_end
        assert result.access_start == self.access_start

    def test_from_rpc_grant_status_with_about_to_expire_grant(self) -> None:
        """Test from_rpc_grant_status with grant expiring now returns NEGATIVE_CACHE status"""
        rpc_grant = RpcEffectiveGrantStatus(
            organization_id=1,
            access_start=self.access_start,
            access_end=self.current_time,  # expires exactly now
        )

        result = EffectiveGrantStatus.from_rpc_grant_status(rpc_grant, self.current_time)

        assert result.cache_status == GrantCacheStatus.NEGATIVE_CACHE

    def test_cache_ttl_for_valid_grant(self) -> None:
        """Test cache_ttl calculation for valid grant"""
        grant_status = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.VALID_WINDOW,
            access_end=self.access_end,
            access_start=self.access_start,
        )

        ttl = grant_status.cache_ttl(self.current_time)
        expected_ttl = int((self.access_end - self.current_time).total_seconds())

        assert ttl == expected_ttl
        assert ttl == 7200  # 2 hours in seconds

    def test_cache_ttl_for_negative_cache(self) -> None:
        """Test cache_ttl for negative cache returns NEGATIVE_CACHE_TTL"""
        grant_status = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.NEGATIVE_CACHE,
        )

        ttl = grant_status.cache_ttl(self.current_time)

        assert ttl == NEGATIVE_CACHE_TTL
        assert ttl == 120  # 2 minutes

    def test_cache_ttl_for_invalid_status_raises_error(self) -> None:
        """Test cache_ttl raises ValueError for invalid cache status"""
        grant_status = EffectiveGrantStatus(
            cache_status=GrantCacheStatus.CACHE_MISS,
        )

        with pytest.raises(ValueError):
            grant_status.cache_ttl(self.current_time)

    def test_post_init_validation_valid_window_without_access_times(self) -> None:
        """Test that __post_init__ raises error when VALID_WINDOW lacks access times"""
        with pytest.raises(ValueError):
            EffectiveGrantStatus(cache_status=GrantCacheStatus.VALID_WINDOW)

    def test_post_init_validation_valid_window_without_access_end(self) -> None:
        """Test that __post_init__ raises error when VALID_WINDOW lacks access_end"""
        with pytest.raises(ValueError):
            EffectiveGrantStatus(
                cache_status=GrantCacheStatus.VALID_WINDOW,
                access_start=self.access_start,
            )

    def test_post_init_validation_valid_window_without_access_start(self) -> None:
        """Test that __post_init__ raises error when VALID_WINDOW lacks access_start"""
        with pytest.raises(ValueError):
            EffectiveGrantStatus(
                cache_status=GrantCacheStatus.VALID_WINDOW,
                access_end=self.access_end,
            )


class GrantCacheStatusTest(TestCase):
    def test_grant_cache_status_values(self) -> None:
        """Test that GrantCacheStatus enum has expected values"""
        assert GrantCacheStatus.CACHE_MISS == "cache_miss"
        assert GrantCacheStatus.NEGATIVE_CACHE == "negative_cache"
        assert GrantCacheStatus.VALID_WINDOW == "valid_window"
        assert GrantCacheStatus.EXPIRED_WINDOW == "expired_window"

    def test_grant_cache_status_is_string_enum(self) -> None:
        """Test that GrantCacheStatus values are strings"""
        for status in GrantCacheStatus:
            assert isinstance(status.value, str)
