import pytest

from sentry.scm.private.rate_limit import (
    is_rate_limited,
    total_limit_key,
    update_rate_limits_from_provider,
    usage_count_key,
)


def test_is_rate_limited_allocated_excess():
    """Assert excess quota for a shared referrer."""
    result = is_rate_limited(
        "github",
        1,
        "my_referrer",
        {"my_referrer": 0.11},
        rate_limit_window_seconds=3600,
        get_and_set_rate_limit=lambda _, __: (100, 10),
        get_time_in_seconds=lambda: 1234567890,
    )
    assert result is False


def test_is_rate_limited_allocated_exhausted():
    """Assert exhausted quota for a specific referrer."""
    result = is_rate_limited(
        "github",
        1,
        "my_referrer",
        {"my_referrer": 1.0},
        rate_limit_window_seconds=3600,
        get_and_set_rate_limit=lambda _, __: (10, 10),
        get_time_in_seconds=lambda: 1234567890,
    )
    assert result is True


def test_is_rate_limited_unallocated_excess():
    """Assert excess shared quota."""
    result = is_rate_limited(
        "github",
        1,
        "shared",
        {},
        rate_limit_window_seconds=3600,
        get_and_set_rate_limit=lambda _, __: (100, 10),
        get_time_in_seconds=lambda: 1234567890,
    )
    assert result is False


def test_is_rate_limited_unallocated_exhausted():
    """Assert exhausted shared quota."""
    result = is_rate_limited(
        "github",
        1,
        "shared",
        {},
        rate_limit_window_seconds=3600,
        get_and_set_rate_limit=lambda _, __: (10, 10),
        get_time_in_seconds=lambda: 1234567890,
    )
    assert result is True


def test_is_rate_limited_unallocated_but_not_shared():
    """A shared or allocated referrer must be passed."""
    with pytest.raises(AssertionError):
        is_rate_limited(
            "github",
            1,
            "other",
            {},
            rate_limit_window_seconds=3600,
            get_and_set_rate_limit=lambda _, __: (10, 10),
            get_time_in_seconds=lambda: 1234567890,
        )


def test_is_rate_limited_limit_not_set():
    """The rate-limit fails open if the limit is not found."""
    result = is_rate_limited(
        "github",
        1,
        "my_referrer",
        {"my_referrer": 0.000000001},
        rate_limit_window_seconds=3600,
        get_and_set_rate_limit=lambda _, __: (None, 100000000000000),
        get_time_in_seconds=lambda: 1234567890,
    )
    assert result is False


def test_update_rate_limits_from_provider():
    """Assert rate-limits are configured from remote."""
    keys = []
    vals = {}
    update_rate_limits_from_provider(
        provider="github",
        organization_id=1,
        referrer_allocation={"a": 0.05, "b": 0.01},
        recorded_limit=100,
        specified_limit=110,
        specified_usage=50,
        specified_next_window=3601,
        rate_limit_window_seconds=3600,
        get_accounted_usage=lambda k: keys.extend(k) or 40,
        get_time_in_seconds=lambda: 73,
        set_key_values=lambda kvs: vals.update(kvs),
    )
    assert keys == [usage_count_key("github", 1, 0, "a"), usage_count_key("github", 1, 0, "b")]
    assert vals == {
        # Sentry said our limit was 100 but GitHub says its 110. GitHub wins.
        total_limit_key("github", 1): 110,
        # GitHub said 50 used but we recorded 40. Shared pool usage is set to reflect.
        usage_count_key("github", 1, 0, "shared"): 10,
    }, vals


def test_update_rate_limits_from_provider_over_count():
    """Assert rate-limits are never negative."""
    vals = {}
    update_rate_limits_from_provider(
        provider="github",
        organization_id=1,
        referrer_allocation={},
        recorded_limit=100,
        specified_limit=110,
        specified_usage=50,
        specified_next_window=3601,
        rate_limit_window_seconds=3600,
        get_accounted_usage=lambda _: 100,
        get_time_in_seconds=lambda: 73,
        set_key_values=lambda kvs: vals.update(kvs),
    )
    assert vals == {
        # Sentry said our limit was 100 but GitHub says its 110. GitHub wins.
        total_limit_key("github", 1): 110,
        # GitHub said 50 used but we recorded 100. Shared pool floored to 0.
        usage_count_key("github", 1, 0, "shared"): 0,
    }, vals


def test_update_rate_limits_from_provider_window_miss():
    """Assert window misses do not update quota usage."""
    vals = {}
    update_rate_limits_from_provider(
        provider="github",
        organization_id=1,
        referrer_allocation={},
        recorded_limit=100,
        specified_limit=110,
        specified_usage=50,
        specified_next_window=0,
        rate_limit_window_seconds=3600,
        get_accounted_usage=lambda _: 100,
        get_time_in_seconds=lambda: 73,
        set_key_values=lambda kvs: vals.update(kvs),
    )
    assert vals == {total_limit_key("github", 1): 110}, vals


def test_update_rate_limits_from_provider_matching_limits():
    """Assert identical totals do not write."""
    vals = {}
    update_rate_limits_from_provider(
        provider="github",
        organization_id=1,
        referrer_allocation={},
        recorded_limit=110,
        specified_limit=110,
        specified_usage=50,
        specified_next_window=3601,
        rate_limit_window_seconds=3600,
        get_accounted_usage=lambda _: 100,
        get_time_in_seconds=lambda: 73,
        set_key_values=lambda kvs: vals.update(kvs),
    )
    assert vals == {usage_count_key("github", 1, 0, "shared"): 0}, vals


def test_update_rate_limits_from_provider_matching_limits_window_miss():
    """Assert no writes if identical totals and accounted usage matches remote."""
    vals = {}
    update_rate_limits_from_provider(
        provider="github",
        organization_id=1,
        referrer_allocation={},
        recorded_limit=110,
        specified_limit=110,
        specified_usage=50,
        specified_next_window=0,
        rate_limit_window_seconds=3600,
        get_accounted_usage=lambda _: 50,
        get_time_in_seconds=lambda: 73,
        set_key_values=lambda kvs: vals.update(kvs),
    )
    assert vals == {}, vals
