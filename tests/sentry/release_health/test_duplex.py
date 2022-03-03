from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from django.utils.datastructures import MultiValueDict
from freezegun import freeze_time

from sentry.release_health import duplex
from sentry.release_health.duplex import ComparatorType as Ct
from sentry.release_health.duplex import (
    DuplexReleaseHealthBackend,
    FixedList,
    ListSet,
    get_sessionsv2_schema,
)
from sentry.snuba.sessions_v2 import AllowedResolution, QueryDefinition


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
        (100, 100, Ct.Exact, True),
        (100, 101, Ct.Exact, False),
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
        ([1, 2, 3], [1, 2, 3], [Ct.Exact], True),
        ([1, 2, 3], [1, 2, 4], [Ct.Exact], False),
        ([(1, 2), (2, 3), (3, 4)], [(1, 2), (2, 3), (3, 4)], [Ct.Exact], True),
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
        (
            [{"a": 1, "b": 11}, {"a": 2, "b": 22}],
            [{"a": 2, "b": 22}, {"a": 1, "b": 11}],
            ListSet({"*": Ct.Exact}, "a"),
            True,
        ),
        (
            [{"a": 1, "b": 11, "c": 3}, {"a": 2, "b": 22, "d": 1}],
            [{"a": 2, "b": 22, "d": 100}, {"a": 1, "b": 11, "c": 3}],
            ListSet({"b": Ct.Exact, "c": Ct.Counter}, "a"),
            True,
        ),
        (
            [{"a": (10, 1), "b": 1}, {"a": (50, 0), "b": 100}],
            [{"a": (100, -50), "b": 101}, {"a": (5, 6), "b": 2}],
            ListSet({"b": Ct.Counter}, lambda x: x["a"][0] + x["a"][1]),
            True,
        ),
        (
            [{"a": (10, 1), "b": 1}, {"a": (50, 0), "b": 200}],
            [{"a": (100, -50), "b": 100}, {"a": (5, 6), "b": 2}],
            ListSet({"b": Ct.Counter}, lambda x: x["a"][0] + x["a"][1]),
            False,
        ),
    ],
)
def test_compare_list_set(sessions, metrics, schema, are_equal):
    result = duplex.compare_list_set(sessions, metrics, 60, "", schema)
    assert (len(result) == 0) == are_equal


@pytest.mark.parametrize(
    "sessions,metrics,schema, are_equal",
    [
        ([1, 2], [1], FixedList([Ct.Exact, Ct.Exact]), False),
        ([1, 2], [1, 2], FixedList([Ct.Exact, Ct.Exact]), True),
        ([1, 2, 3], [1, 2, 4], FixedList([Ct.Exact, Ct.Exact, Ct.Ignore]), True),
    ],
)
def test_compare_fixed_list(sessions, metrics, schema, are_equal):
    result = duplex.compare_fixed_list(sessions, metrics, 60, "", schema)
    assert (len(result) == 0) == are_equal


@pytest.mark.parametrize(
    "sessions,metrics,schema, are_equal",
    [
        # compare as array of entities
        ((1, 2, 3), (1, 2, 3), None, True),
        ((1, 2), (1, 2), (Ct.Exact, Ct.Exact), True),
        ((1, 2), (1, 3), (Ct.Exact, Ct.Exact), False),
        ((1, 2), (1, 3), (Ct.Exact, Ct.Counter), True),
        ([1, 2.1, 3], [1, 2.11, 4], (Ct.Exact, Ct.Ratio, Ct.Counter), True),
        (((1, 2), (2, 3)), ((1, 2), (2, 3)), [Ct.Exact, Ct.Exact], True),
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
        ({"a": 1, "b": 2, "c": 3}, {"a": 1, "b": 3, "c": 4}, {"*": Ct.Exact}, False),
        ({"a": 1, "b": 2, "c": 3}, {"a": 1, "b": 3, "c": 4}, {"*": Ct.Counter}, True),
        # match all unspecified as counters, and "c" as Exact
        (
            {"a": 1, "b": 2, "c": 3},
            {"a": 2, "b": 3, "c": 3},
            {"*": Ct.Counter, "c": Ct.Exact},
            True,
        ),
        # match subset of properties
        (
            {"a": 1, "b": 2, "c": 3},
            {"a": 1, "b": 3, "c": 44},
            {"a": Ct.Exact, "b": Ct.Counter},
            True,
        ),
        # match overspecified schema
        (
            {"a": 1},
            {"a": 1},
            {"a": Ct.Exact, "b": Ct.Counter},
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
                "b": Ct.Exact,
                "c": [{"a": (Ct.Exact, Ct.Ratio, Ct.Counter), "b": Ct.Ignore}],
                "d": Ct.Exact,
                "e": Ct.Counter,
            },
            True,
        ),
        # explicitly partial match
        (
            {
                "a": [Ct.Counter],
                "b": Ct.Exact,
                "c": [{"a": (Ct.Exact, Ct.Ratio, Ct.Counter)}],
            },
            True,
        ),
        # implicit matching matching counters as explicit entities should fail
        (
            {
                "a": Ct.Ignore,
                "b": Ct.Ignore,
                "c": Ct.Ignore,
                "*": Ct.Exact,
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
                "c": [{"a": (Ct.Exact, Ct.Ratio, Ct.Counter), "b": Ct.Ignore}],
                "e": Ct.Counter,
                "*": Ct.Exact,
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


def test_run_sessions_query_schema():
    """
    Tests the specific complex schema for runs_sessions_query.

    Since the schema is embedded in the function and there is no clean way to test the function directly this
    test copies and pastes the schema (it still serves as a test for a complex schema).
    """

    def index_by(d):
        return tuple(sorted(d["by"].items(), key=lambda t: t[0]))  # type: ignore

    schema_for_totals = {
        "sum(session)": Ct.Counter,
        "count_unique(user)": Ct.Counter,
        "avg(session.duration)": Ct.Quantile,
        "p50(session.duration)": Ct.Quantile,
        "p75(session.duration)": Ct.Quantile,
        "p90(session.duration)": Ct.Quantile,
        "p95(session.duration)": Ct.Quantile,
        "p99(session.duration)": Ct.Quantile,
        "max(session.duration)": Ct.Quantile,
    }
    schema_for_series = {field: [comparator] for field, comparator in schema_for_totals.items()}

    schema = {
        "start": Ct.DateTime,
        "end": Ct.DateTime,
        "intervals": [Ct.DateTime],
        "groups": ListSet(
            schema={
                "by": Ct.Ignore,
                "series": schema_for_series,
                "totals": schema_for_totals,
            },
            index_by=index_by,
        ),
        "query": Ct.Exact,
    }

    sessions = {
        "start": "2021-02-01T00:00:00Z",
        "end": "2021-02-04T00:00:00Z",
        "intervals": ["2021-02-01T00:00:00Z", "2021-02-02T00:00:00Z", "2021-02-03T00:00:00Z"],
        "groups": [
            {
                "by": {
                    "session.status": "healthy",
                    "environment": "release",
                },
                "totals": {"sum(session)": 1715553},
                "series": {"sum(session)": [683772, 677788, 353993]},
            },
            {
                "by": {
                    "session.status": "abnormal",
                    "environment": "release",
                },
                "totals": {"sum(session)": 0},
                "series": {"sum(session)": [0, 0, 0]},
            },
        ],
    }
    metrics = {
        "start": "2021-02-01T00:00:00Z",
        "end": "2021-02-04T00:00:00Z",
        "intervals": ["2021-02-01T00:00:00Z", "2021-02-02T00:00:00Z", "2021-02-03T00:00:00Z"],
        "groups": [
            {
                "by": {"environment": "release", "session.status": "abnormal"},
                "totals": {"sum(session)": 0},
                "series": {"sum(session)": [0, 0, 0]},
            },
            {
                "by": {
                    "environment": "release",
                    "session.status": "healthy",
                },
                "totals": {"sum(session)": 1715553},
                "series": {"sum(session)": [683772, 677788, 353993]},
            },
        ],
    }

    result = duplex.compare_results(sessions, metrics, 60, "", schema)
    assert len(result) == 0


def _get_duplex_with_mocks(metrics_start: datetime):
    """Returns the DuplexReleaseHealthBackend with the Senssions and Metrics backends mocked"""
    ret_val = DuplexReleaseHealthBackend(metrics_start)
    ret_val.sessions = MagicMock()
    ret_val.metrics = MagicMock()
    ret_val.log_exception = MagicMock()
    ret_val.log_errors = MagicMock()
    ret_val.compare_results = MagicMock()
    return ret_val


@pytest.mark.skip(reason="Requires Db")
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


@freeze_time("2022-03-02 15:17")
def test_get_sessionsv2_schema():
    query = QueryDefinition(
        query=MultiValueDict(
            {
                "statsPeriod": ["24h"],
                "interval": ["1h"],
                "field": ["sum(session)", "avg(session.duration)"],
            }
        ),
        params={},
        allowed_resolution=AllowedResolution.one_hour,
    )
    schema = get_sessionsv2_schema(datetime.now(timezone.utc), query)
    assert schema["sum(session)"] == FixedList(22 * [Ct.Counter] + 2 * [Ct.Ignore])
    assert schema["avg(session.duration)"] == FixedList(22 * [Ct.Quantile] + 2 * [Ct.Ignore])
