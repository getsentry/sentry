import pytest

from sentry.issues.formatting.limits import LIMITS_DEFAULT, LIMITS_LOW, Limits


def test_default_preset_matches_seer() -> None:
    assert LIMITS_DEFAULT.max_exceptions_chars == 100_000
    assert LIMITS_DEFAULT.max_stacktrace_chars == 20_000
    assert LIMITS_DEFAULT.max_spans_chars == 5_000
    # uncapped in the default preset
    assert LIMITS_DEFAULT.max_request_chars is None
    assert LIMITS_DEFAULT.max_breadcrumbs_chars is None
    assert LIMITS_DEFAULT.max_single_breadcrumb_chars is None


def test_low_preset_matches_seer() -> None:
    assert LIMITS_LOW.max_exceptions_chars == 50_000
    assert LIMITS_LOW.max_stacktrace_chars == 10_000
    assert LIMITS_LOW.max_request_chars == 2_000
    assert LIMITS_LOW.max_breadcrumbs_chars == 5_000
    assert LIMITS_LOW.max_single_breadcrumb_chars == 500
    assert LIMITS_LOW.max_spans_chars == 5_000


def test_count_caps_default() -> None:
    # folded-in count caps (Seer hardcodes these)
    assert LIMITS_DEFAULT.max_frames == 16
    assert LIMITS_DEFAULT.max_breadcrumbs == 10
    assert LIMITS_LOW.max_frames == 16
    assert LIMITS_LOW.max_breadcrumbs == 10


def test_limits_are_frozen() -> None:
    limits = Limits()
    with pytest.raises((AttributeError, TypeError)):
        limits.max_frames = 5  # type: ignore[misc]
