from datetime import datetime
from unittest.mock import MagicMock

import pytest

from sentry.release_health import duplex
from sentry.release_health.duplex import ComparatorType as Ct
from sentry.release_health.duplex import DuplexReleaseHealthBackend


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
        (100, 110, Ct.Counter, False),
        (100, 105, Ct.Counter, True),
        # no schema will compare as entity and fail
        (100, 105, None, False),
        # no schema will compare as entity and succeed
        (100, 100, None, True),
        (100, 100, Ct.Entity, True),
        (100, 101, Ct.Entity, False),
        (9.0, 9.05, Ct.Quantile, True),
        (9.0, 9.05, Ct.Ratio, True),
        (9.0, 9.1, Ct.Ratio, False),
        # no schema, no problem, will figure out float and compare as ratio
        (9.0, 9.05, None, True),
        ("2021-10-10T10:15", "2021-10-10T10:15:30", Ct.DateTime, True),
        # no schema will treat string as entity and fail
        ("2021-10-10T10:15", "2021-10-10T10:15:30", None, False),
        (
            datetime(2021, 10, 10, 10, 15, 0),
            datetime(2021, 10, 10, 10, 15, 30),
            Ct.DateTime,
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
    assert (len(actual_errors) == 0) == are_equal


@pytest.mark.parametrize(
    "sessions,metrics,schema, are_equal",
    [
        # compare as array of entities
        ([1, 2, 3], [1, 2, 3], None, True),
        ([1, 2, 3], [1, 2, 3], [Ct.Entity], True),
        ([1, 2, 3], [1, 2, 4], [Ct.Entity], False),
        ([(1, 2), (2, 3), (3, 4)], [(1, 2), (2, 3), (3, 4)], [Ct.Entity], True),
        ([1, 2, 3], [1, 2], None, False),
        ([1, 2, 3], [1, 2, 4], [Ct.Counter], True),
        (
            [datetime(2021, 10, 10, 12, 30, 10)],
            [datetime(2021, 10, 10, 12, 30, 20)],
            [Ct.DateTime],
            True,
        ),
    ],
)
def test_compare_arrays(sessions, metrics, schema, are_equal):
    result = duplex.compare_arrays(sessions, metrics, 60, "", schema)
    assert (len(result) == 0) == are_equal


@pytest.mark.parametrize(
    "sessions,metrics,schema, are_equal",
    [
        # compare as array of entities
        ((1, 2, 3), (1, 2, 3), None, True),
        ((1, 2), (1, 2), (Ct.Entity, Ct.Entity), True),
        ((1, 2), (1, 3), (Ct.Entity, Ct.Entity), False),
        ((1, 2), (1, 3), (Ct.Entity, Ct.Counter), True),
        ([1, 2.1, 3], [1, 2.11, 4], (Ct.Entity, Ct.Ratio, Ct.Counter), True),
        (((1, 2), (2, 3)), ((1, 2), (2, 3)), [Ct.Entity, Ct.Entity], True),
        ((1, 2, 3), (1, 2), None, False),
    ],
)
def test_compare_tuples(sessions, metrics, schema, are_equal):
    result = duplex.compare_tuples(sessions, metrics, 60, "", schema)
    assert (len(result) == 0) == are_equal


@pytest.mark.parametrize(
    "sessions,metrics,schema, are_equal",
    [
        # match all as default entities
        ({"a": 1, "b": 2, "c": 3}, {"a": 1, "b": 3, "c": 44}, None, False),
        ({"a": 1, "b": 2, "c": 3}, {"a": 1, "b": 2, "c": 3}, None, True),
        # match all as configured types
        ({"a": 1, "b": 2, "c": 3}, {"a": 1, "b": 3, "c": 4}, {"*": Ct.Entity}, False),
        ({"a": 1, "b": 2, "c": 3}, {"a": 1, "b": 3, "c": 4}, {"*": Ct.Counter}, True),
        # match all unspecified as counters, and "c" as Entity
        (
            {"a": 1, "b": 2, "c": 3},
            {"a": 2, "b": 3, "c": 3},
            {"*": Ct.Counter, "c": Ct.Entity},
            True,
        ),
        # match subset of properties
        (
            {"a": 1, "b": 2, "c": 3},
            {"a": 1, "b": 3, "c": 44},
            {"a": Ct.Entity, "b": Ct.Counter},
            True,
        ),
    ],
)
def test_compare_dicts(sessions, metrics, schema, are_equal):
    result = duplex.compare_dicts(sessions, metrics, 60, "", schema)
    assert (len(result) == 0) == are_equal


@pytest.mark.parametrize(
    "schema, are_equal",
    [
        # explicitly match everything
        (
            {
                "a": [Ct.Counter],
                "b": Ct.Entity,
                "c": [{"a": (Ct.Entity, Ct.Ratio, Ct.Counter), "b": Ct.Ignore}],
                "d": Ct.Entity,
                "e": Ct.Counter,
            },
            True,
        ),
        # explicitly partial match
        (
            {
                "a": [Ct.Counter],
                "b": Ct.Entity,
                "c": [{"a": (Ct.Entity, Ct.Ratio, Ct.Counter)}],
            },
            True,
        ),
        # implicit matching matching counters as explicit entities should fail
        (
            {
                "a": Ct.Ignore,
                "b": Ct.Ignore,
                "c": Ct.Ignore,
                "*": Ct.Entity,
            },
            False,
        ),
        # implicit matching counters as implicit entities should fail
        (
            {
                "a": Ct.Ignore,
                "b": Ct.Ignore,
                "c": Ct.Ignore,
                "*": None,  # scalars are implicitly matched as Entities
            },
            False,
        ),
        # implicit matching matching counters as counters should succeed
        (
            {
                "a": Ct.Ignore,
                "b": Ct.Ignore,
                "c": Ct.Ignore,
                "*": Ct.Counter,
            },
            True,
        ),
        # implicitly match entities
        (
            {
                "a": [Ct.Counter],
                "c": [{"a": (Ct.Entity, Ct.Ratio, Ct.Counter), "b": Ct.Ignore}],
                "e": Ct.Counter,
                "*": Ct.Entity,
            },
            True,
        ),
    ],
)
def test_compare_complex_structures(schema, are_equal):
    sessions = {
        "a": [1, 2, 3],
        "b": "rel-1",
        "c": [{"a": (1, 2.3, 4)}, {"a": (2, 3.3, 5)}, {"a": (1, 3.3, 5), "b": 1}],
        "d": 1,
        "e": 1,
    }
    metrics = {
        "a": [1, 2, 4],
        "b": "rel-1",
        "c": [{"a": (1, 2.31, 5)}, {"a": (2, 3.31, 6)}, {"a": (1, 3.31, 6), "b": 121}],
        "d": 1,
        "e": 2,
    }

    result = duplex.compare_results(sessions, metrics, 60, "", schema)
    assert (len(result) == 0) == are_equal


def _get_duplex_with_mocks(metrics_start: datetime):
    """Returns the DuplexReleaseHealthBackend with the Senssions and Metrics backends mocked"""
    ret_val = DuplexReleaseHealthBackend(metrics_start)
    ret_val.sessions = MagicMock()
    ret_val.metrics = MagicMock()
    ret_val.log_exception = MagicMock()
    ret_val.log_errors = MagicMock()
    ret_val.compare_results = MagicMock()
    return ret_val


def test_function_dispatch_is_working():
    duplex = _get_duplex_with_mocks(datetime(2021, 10, 4, 12, 0))

    duplex.sessions.get_current_and_previous_crash_free_rates.return_value = "ret-sessions"
    duplex.metrics.get_current_and_previous_crash_free_rates.return_value = "ret-metrics"

    call_params = [
        [1, 2],
        datetime(2021, 10, 10),
        datetime(2021, 10, 11),
        datetime(2021, 10, 5),
        datetime(2021, 10, 7),
        30,
        1,
    ]
    duplex.get_current_and_previous_crash_free_rates(*call_params)
    # check the both implementation were called
    duplex.sessions.get_current_and_previous_crash_free_rates.assert_called_once_with(*call_params)
    duplex.metrics.get_current_and_previous_crash_free_rates.assert_called_once_with(*call_params)

    # check log errors is called with whatever compare_results returned and with the returns from the two backends
    args = duplex.log_errors.call_args
    assert args[0][1] == "ret-sessions"
    assert args[0][2] == "ret-metrics"

    # set the request to cover times before metrics were available
    call_params[3] = datetime(2021, 10, 1)
    duplex.get_current_and_previous_crash_free_rates(*call_params)
    # check sessions backend was called with the new data
    duplex.sessions.get_current_and_previous_crash_free_rates.assert_called_with(*call_params)
    # check metrics backend were not called again (only one original call)
    assert duplex.metrics.get_current_and_previous_crash_free_rates.call_count == 1
