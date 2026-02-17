from datetime import datetime, timezone

import pytest

from sentry.data_secrecy.service.model import RpcEffectiveGrantStatus
from sentry.data_secrecy.types import NEGATIVE_CACHE_TTL, EffectiveGrantStatus, GrantCacheStatus
from sentry.testutils.helpers.datetime import freeze_time

# Test fixtures
CURRENT_TIME = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
ACCESS_START = datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
ACCESS_END = datetime(2025, 1, 1, 14, 0, 0, tzinfo=timezone.utc)
EXPIRED_ACCESS_END = datetime(2025, 1, 1, 11, 0, 0, tzinfo=timezone.utc)


def test_from_cache_with_none() -> None:
    """Test from_cache with None returns CACHE_MISS status"""
    result = EffectiveGrantStatus.from_cache(None)

    assert result.cache_status == GrantCacheStatus.CACHE_MISS
    assert result.access_end is None
    assert result.access_start is None


def test_from_cache_with_negative_cache_object() -> None:
    """Test from_cache with negative cache object returns the same object"""
    cached_object = EffectiveGrantStatus(cache_status=GrantCacheStatus.NEGATIVE_CACHE)
    result = EffectiveGrantStatus.from_cache(cached_object)

    assert result.cache_status == GrantCacheStatus.NEGATIVE_CACHE
    assert result.access_end is None
    assert result.access_start is None
    assert result is cached_object  # Should return the same object


@freeze_time("2025-01-01 12:00:00")
def test_from_cache_with_expired_grant_object() -> None:
    """Test from_cache with expired grant object returns EXPIRED_WINDOW status"""
    cached_object = EffectiveGrantStatus(
        cache_status=GrantCacheStatus.VALID_WINDOW,
        access_start=ACCESS_START,
        access_end=EXPIRED_ACCESS_END,  # expired
    )

    result = EffectiveGrantStatus.from_cache(cached_object)

    assert result.cache_status == GrantCacheStatus.EXPIRED_WINDOW
    assert result.access_end is None
    assert result.access_start is None


@freeze_time("2025-01-01 12:00:00")
def test_from_cache_with_valid_grant_object() -> None:
    """Test from_cache with valid grant object returns the same object"""
    cached_object = EffectiveGrantStatus(
        cache_status=GrantCacheStatus.VALID_WINDOW,
        access_start=ACCESS_START,
        access_end=ACCESS_END,  # future time
    )

    result = EffectiveGrantStatus.from_cache(cached_object)

    assert result.cache_status == GrantCacheStatus.VALID_WINDOW
    assert result.access_end == ACCESS_END
    assert result.access_start == ACCESS_START
    assert result is cached_object  # Should return the same object


def test_from_rpc_grant_status_with_none() -> None:
    """Test from_rpc_grant_status with None returns NEGATIVE_CACHE status"""
    result = EffectiveGrantStatus.from_rpc_grant_status(None, CURRENT_TIME)

    assert result.cache_status == GrantCacheStatus.NEGATIVE_CACHE
    assert result.access_end is None
    assert result.access_start is None


def test_from_rpc_grant_status_with_expired_grant() -> None:
    """Test from_rpc_grant_status with expired grant returns NEGATIVE_CACHE status"""
    rpc_grant = RpcEffectiveGrantStatus(
        organization_id=1,
        access_start=ACCESS_START,
        access_end=EXPIRED_ACCESS_END,
    )

    result = EffectiveGrantStatus.from_rpc_grant_status(rpc_grant, CURRENT_TIME)

    assert result.cache_status == GrantCacheStatus.NEGATIVE_CACHE
    assert result.access_end is None
    assert result.access_start is None


def test_from_rpc_grant_status_with_valid_grant() -> None:
    """Test from_rpc_grant_status with valid grant returns VALID_WINDOW status"""
    rpc_grant = RpcEffectiveGrantStatus(
        organization_id=1,
        access_start=ACCESS_START,
        access_end=ACCESS_END,
    )

    result = EffectiveGrantStatus.from_rpc_grant_status(rpc_grant, CURRENT_TIME)

    assert result.cache_status == GrantCacheStatus.VALID_WINDOW
    assert result.access_end == ACCESS_END
    assert result.access_start == ACCESS_START


def test_from_rpc_grant_status_with_about_to_expire_grant() -> None:
    """Test from_rpc_grant_status with grant expiring now returns NEGATIVE_CACHE status"""
    rpc_grant = RpcEffectiveGrantStatus(
        organization_id=1,
        access_start=ACCESS_START,
        access_end=CURRENT_TIME,  # expires exactly now
    )

    result = EffectiveGrantStatus.from_rpc_grant_status(rpc_grant, CURRENT_TIME)

    assert result.cache_status == GrantCacheStatus.NEGATIVE_CACHE


def test_cache_ttl_for_valid_grant() -> None:
    """Test cache_ttl calculation for valid grant"""
    grant_status = EffectiveGrantStatus(
        cache_status=GrantCacheStatus.VALID_WINDOW,
        access_end=ACCESS_END,
        access_start=ACCESS_START,
    )

    ttl = grant_status.cache_ttl(CURRENT_TIME)
    expected_ttl = int((ACCESS_END - CURRENT_TIME).total_seconds())

    assert ttl == expected_ttl
    assert ttl == 7200  # 2 hours in seconds


def test_cache_ttl_for_negative_cache() -> None:
    """Test cache_ttl for negative cache returns NEGATIVE_CACHE_TTL"""
    grant_status = EffectiveGrantStatus(
        cache_status=GrantCacheStatus.NEGATIVE_CACHE,
    )

    ttl = grant_status.cache_ttl(CURRENT_TIME)

    assert ttl == NEGATIVE_CACHE_TTL
    assert ttl == 120  # 2 minutes


def test_cache_ttl_for_invalid_status_raises_error() -> None:
    """Test cache_ttl raises ValueError for invalid cache status"""
    grant_status = EffectiveGrantStatus(
        cache_status=GrantCacheStatus.CACHE_MISS,
    )

    with pytest.raises(ValueError):
        grant_status.cache_ttl(CURRENT_TIME)


def test_post_init_validation_valid_window_without_access_times() -> None:
    """Test that __post_init__ raises error when VALID_WINDOW lacks access times"""
    with pytest.raises(ValueError):
        EffectiveGrantStatus(cache_status=GrantCacheStatus.VALID_WINDOW)


def test_post_init_validation_valid_window_without_access_end() -> None:
    """Test that __post_init__ raises error when VALID_WINDOW lacks access_end"""
    with pytest.raises(ValueError):
        EffectiveGrantStatus(
            cache_status=GrantCacheStatus.VALID_WINDOW,
            access_start=ACCESS_START,
        )


def test_post_init_validation_valid_window_without_access_start() -> None:
    """Test that __post_init__ raises error when VALID_WINDOW lacks access_start"""
    with pytest.raises(ValueError):
        EffectiveGrantStatus(
            cache_status=GrantCacheStatus.VALID_WINDOW,
            access_end=ACCESS_END,
        )


def test_grant_cache_status_values() -> None:
    """Test that GrantCacheStatus enum has expected values"""
    assert GrantCacheStatus.CACHE_MISS == "cache_miss"
    assert GrantCacheStatus.NEGATIVE_CACHE == "negative_cache"
    assert GrantCacheStatus.VALID_WINDOW == "valid_window"
    assert GrantCacheStatus.EXPIRED_WINDOW == "expired_window"


def test_grant_cache_status_is_string_enum() -> None:
    """Test that GrantCacheStatus values are strings"""
    for status in GrantCacheStatus:
        assert isinstance(status.value, str)
