from datetime import datetime

import pytest

from sentry.release_health import duplex
from sentry.release_health.duplex import ComparatorType


@pytest.mark.parametrize(
    "sessions,metrics,are_equal",
    [
        (1, 1, True),
        (1, 2, False),
        ("ab", "ab", True),
        ("ab", "ac", False),
        ((1, "ab"), (1, "ab"), True),
        ((1, "ab"), (1, "ac"), False),
        ((1, "ab"), (2, "ab"), False),
    ],
)
def test_compare_entities(sessions, metrics, are_equal):
    result = duplex.compare_entities(sessions, metrics, "a.b")
    assert (result is None) == are_equal


@pytest.mark.parametrize(
    "sessions,metrics,final_result,are_equal",
    [
        (None, None, True, True),
        (None, 2, True, False),
        (2, None, True, False),
        ("ab", "XY", False, True),
    ],
)
def test_compare_basic(sessions, metrics, final_result, are_equal):
    """
    Tests  basic checks that apply to all checkers
    """
    actual_final, actual_errors = duplex._compare_basic(sessions, metrics, "a.b")
    assert actual_final == final_result
    assert (actual_errors is None) == are_equal


@pytest.mark.parametrize(
    "sessions,metrics,rollup,are_equal",
    [
        ("2021-10-10T10:15", "2021-10-10T10:16", 3600, True),
        ("2021-10-10T10:15", "2021-10-10T10:16", 36, False),
        (datetime(2021, 10, 10, 10, 15), datetime(2021, 10, 10, 10, 16), 3600, True),
        (datetime(2021, 10, 10, 10, 15), datetime(2021, 10, 10, 10, 16), 36, False),
        ("2021-10-10T10:15", "abc", 36, False),
    ],
)
def test_compare_datetime(sessions, metrics, rollup, are_equal):
    result = duplex.compare_datetime(sessions, metrics, rollup, "a.b")
    assert (result is None) == are_equal


@pytest.mark.parametrize(
    "sessions,metrics,are_equal",
    [
        (100, 110, False),
        (100, 105, True),
        (100, 96, True),
        (None, None, True),
        (None, 1, False),
        (0, None, False),
        (1, 3, True),
        (1, 7, False),
        (9, 11, True),
        (9, 20, False),
    ],
)
def test_compare_counters(sessions, metrics, are_equal):
    result = duplex.compare_counters(sessions, metrics, "a.b")
    assert (result is None) == are_equal


@pytest.mark.parametrize("use_quantiles", [True, False])
@pytest.mark.parametrize(
    "sessions,metrics,are_equal",
    [
        (100.0, 110.0, False),
        (100.0, 101.0, True),
        (100.0, 99.0, True),
        (None, None, True),
        (None, 1, False),
        (0.0, None, False),
        (1.0, 1.01, True),
        (1.0, 7.0, False),
        (9.0, 9.05, True),
        (9.0, 8.95, True),
        (9.0, 20.0, False),
    ],
)
def test_compare_floats(use_quantiles, sessions, metrics, are_equal):
    """
    Tests compare_quantiles and compare_ratios (at the moment the
    implementations are identical, if the implementation changes this
    test should be broken in two).
    """
    if use_quantiles:
        result = duplex.compare_quantiles(sessions, metrics, "a.b")
    else:
        result = duplex.compare_ratios(sessions, metrics, "a.b")
    assert (result is None) == are_equal


@pytest.mark.parametrize(
    "sessions,metrics,schema, are_equal",
    [
        (100, 110, ComparatorType.Counter, False),
        (100, 105, ComparatorType.Counter, True),
        # no schema will compare as entity and fail
        (100, 105, None, False),
        # no schema will compare as entity and succeed
        (100, 100, None, True),
        (100, 100, ComparatorType.Entity, True),
        (100, 101, ComparatorType.Entity, False),
        (9.0, 9.05, ComparatorType.Quantile, True),
        (9.0, 9.05, ComparatorType.Ratio, True),
        (9.0, 9.1, ComparatorType.Ratio, False),
        # no schema, no problem, will figure out float and compare as ratio
        (9.0, 9.05, None, True),
        ("2021-10-10T10:15", "2021-10-10T10:15:30", ComparatorType.DateTime, True),
        # no schema will treat string as entity and fail
        ("2021-10-10T10:15", "2021-10-10T10:15:30", None, False),
        (
            datetime(2021, 10, 10, 10, 15, 0),
            datetime(2021, 10, 10, 10, 15, 30),
            ComparatorType.DateTime,
            True,
        ),
        # no schema will still figure out to compare as datetime and succeed
        (datetime(2021, 10, 10, 10, 15, 0), datetime(2021, 10, 10, 10, 15, 30), None, True),
    ],
)
def test_compare_scalars(sessions, metrics, schema, are_equal):
    result = duplex.compare_scalars(sessions, metrics, 60, "a.b", schema)
    assert (result is None) == are_equal


@pytest.mark.parametrize(
    "sessions,metrics,final_result, are_equal",
    [
        (None, None, True, True),
        (None, [2], True, False),
        ([2], None, True, False),
        ([1, 2], [1], True, False),
        (["ab"], ["XY"], False, True),
        ([1, 2], [1, 2], False, True),
        ((1, 2), (1), True, False),
        (("ab"), ("XY"), False, True),
    ],
)
def test_compare_basic_sequence(sessions, metrics, final_result, are_equal):
    actual_final, actual_errors = duplex._compare_basic_sequence(sessions, metrics, "a.b")
    assert actual_final == final_result
    assert (actual_errors == []) == are_equal
