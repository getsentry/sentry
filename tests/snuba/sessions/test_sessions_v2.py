import math
import pytest
import pytz

from datetime import datetime
from freezegun import freeze_time
from django.http import QueryDict

# from sentry.testutils import TestCase
from sentry.snuba.sessions_v2 import (
    QueryDefinition,
    massage_sessions_result,
    _get_timestamps,
    InvalidParams,
    _get_constrained_date_range,
)


def _make_query(qs, allow_minute_resolution=True):
    return QueryDefinition(QueryDict(qs), {}, allow_minute_resolution)


def result_sorted(result):
    """sort the groups of the results array by the `by` object, ensuring a stable order"""

    def stable_dict(d):
        return tuple(sorted(d.items(), key=lambda t: t[0]))

    result["groups"].sort(key=lambda group: stable_dict(group["by"]))
    return result


@freeze_time("2018-12-11 03:21:00")
def test_round_range():
    start, end, interval = _get_constrained_date_range({"statsPeriod": "2d"})
    assert start == datetime(2018, 12, 9, 4, tzinfo=pytz.utc)
    assert end == datetime(2018, 12, 11, 3, 22, tzinfo=pytz.utc)

    start, end, interval = _get_constrained_date_range({"statsPeriod": "2d", "interval": "1d"})
    assert start == datetime(2018, 12, 10, tzinfo=pytz.utc)
    assert end == datetime(2018, 12, 11, 3, 22, tzinfo=pytz.utc)


def test_invalid_interval():
    with pytest.raises(InvalidParams):
        start, end, interval = _get_constrained_date_range({"interval": "0d"})


def test_round_exact():
    start, end, interval = _get_constrained_date_range(
        {"start": "2021-01-12T04:06:16", "end": "2021-01-17T08:26:13", "interval": "1d"},
    )
    assert start == datetime(2021, 1, 12, tzinfo=pytz.utc)
    assert end == datetime(2021, 1, 18, tzinfo=pytz.utc)


def test_inclusive_end():
    start, end, interval = _get_constrained_date_range(
        {"start": "2021-02-24T00:00:00", "end": "2021-02-25T00:00:00", "interval": "1h"},
    )
    assert start == datetime(2021, 2, 24, tzinfo=pytz.utc)
    assert end == datetime(2021, 2, 25, 1, tzinfo=pytz.utc)


@freeze_time("2021-03-05T11:14:17.105Z")
def test_interval_restrictions():
    # making sure intervals are cleanly divisible
    with pytest.raises(InvalidParams, match="The interval has to be less than one day."):
        _make_query("statsPeriod=4d&interval=2d&field=sum(session)")
    with pytest.raises(
        InvalidParams, match="The interval should divide one day without a remainder."
    ):
        _make_query("statsPeriod=6h&interval=59m&field=sum(session)")
    with pytest.raises(
        InvalidParams, match="The interval should divide one day without a remainder."
    ):
        _make_query("statsPeriod=4d&interval=5h&field=sum(session)")

    _make_query("statsPeriod=6h&interval=90m&field=sum(session)")
    with pytest.raises(
        InvalidParams,
        match="The interval has to be a multiple of the minimum interval of one hour.",
    ):
        _make_query("statsPeriod=6h&interval=90m&field=sum(session)", False)

    with pytest.raises(
        InvalidParams,
        match="The interval has to be a multiple of the minimum interval of one minute.",
    ):
        _make_query("statsPeriod=1h&interval=90s&field=sum(session)")

    # restrictions for minute resolution time range
    with pytest.raises(
        InvalidParams,
        match="The time-range when using one-minute resolution intervals is restricted to 6 hours.",
    ):
        _make_query("statsPeriod=7h&interval=15m&field=sum(session)")
    with pytest.raises(
        InvalidParams,
        match="The time-range when using one-minute resolution intervals is restricted to the last 30 days.",
    ):
        _make_query(
            "start=2021-01-05T11:14:17&end=2021-01-05T12:14:17&interval=15m&field=sum(session)"
        )

    with pytest.raises(
        InvalidParams, match="Your interval and date range would create too many results."
    ):
        _make_query("statsPeriod=90d&interval=1h&field=sum(session)")


@freeze_time("2020-12-18T11:14:17.105Z")
def test_timestamps():
    query = _make_query("statsPeriod=1d&interval=12h&field=sum(session)")

    expected_timestamps = ["2020-12-17T12:00:00Z", "2020-12-18T00:00:00Z"]
    actual_timestamps = _get_timestamps(query)

    assert actual_timestamps == expected_timestamps


@freeze_time("2021-03-08T09:34:00.000Z")
def test_hourly_rounded_start():
    query = _make_query("statsPeriod=30m&interval=1m&field=sum(session)")

    actual_timestamps = _get_timestamps(query)

    assert actual_timestamps[0] == "2021-03-08T09:00:00Z"
    assert actual_timestamps[-1] == "2021-03-08T09:34:00Z"
    assert len(actual_timestamps) == 35

    # in this case "45m" means from 08:49:00-09:34:00, but since we round start/end
    # to hours, we extend the start time to 08:00:00.
    query = _make_query("statsPeriod=45m&interval=1m&field=sum(session)")

    actual_timestamps = _get_timestamps(query)

    assert actual_timestamps[0] == "2021-03-08T08:00:00Z"
    assert actual_timestamps[-1] == "2021-03-08T09:34:00Z"
    assert len(actual_timestamps) == 95


def test_rounded_end():
    query = _make_query(
        "field=sum(session)&interval=1h&start=2021-02-24T00:00:00Z&end=2021-02-25T00:00:00Z"
    )

    expected_timestamps = [
        "2021-02-24T00:00:00Z",
        "2021-02-24T01:00:00Z",
        "2021-02-24T02:00:00Z",
        "2021-02-24T03:00:00Z",
        "2021-02-24T04:00:00Z",
        "2021-02-24T05:00:00Z",
        "2021-02-24T06:00:00Z",
        "2021-02-24T07:00:00Z",
        "2021-02-24T08:00:00Z",
        "2021-02-24T09:00:00Z",
        "2021-02-24T10:00:00Z",
        "2021-02-24T11:00:00Z",
        "2021-02-24T12:00:00Z",
        "2021-02-24T13:00:00Z",
        "2021-02-24T14:00:00Z",
        "2021-02-24T15:00:00Z",
        "2021-02-24T16:00:00Z",
        "2021-02-24T17:00:00Z",
        "2021-02-24T18:00:00Z",
        "2021-02-24T19:00:00Z",
        "2021-02-24T20:00:00Z",
        "2021-02-24T21:00:00Z",
        "2021-02-24T22:00:00Z",
        "2021-02-24T23:00:00Z",
        "2021-02-25T00:00:00Z",
    ]
    actual_timestamps = _get_timestamps(query)

    assert len(actual_timestamps) == 25
    assert actual_timestamps == expected_timestamps


def test_simple_query():
    query = _make_query("statsPeriod=1d&interval=12h&field=sum(session)")

    assert query.query_columns == ["sessions"]


def test_groupby_query():
    query = _make_query("statsPeriod=1d&interval=12h&field=sum(session)&groupBy=release")

    assert sorted(query.query_columns) == ["release", "sessions"]
    assert query.query_groupby == ["release"]


def test_virtual_groupby_query():
    query = _make_query("statsPeriod=1d&interval=12h&field=sum(session)&groupBy=session.status")

    assert sorted(query.query_columns) == [
        "sessions",
        "sessions_abnormal",
        "sessions_crashed",
        "sessions_errored",
    ]
    assert query.query_groupby == []

    query = _make_query(
        "statsPeriod=1d&interval=12h&field=count_unique(user)&groupBy=session.status"
    )

    assert sorted(query.query_columns) == [
        "users",
        "users_abnormal",
        "users_crashed",
        "users_errored",
    ]
    assert query.query_groupby == []


@freeze_time("2020-12-18T11:14:17.105Z")
def test_massage_empty():
    query = _make_query("statsPeriod=1d&interval=1d&field=sum(session)")

    result_totals = []
    result_timeseries = []

    expected_result = {
        "start": "2020-12-18T00:00:00Z",
        "end": "2020-12-18T11:15:00Z",
        "query": "",
        "intervals": ["2020-12-18T00:00:00Z"],
        "groups": [],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_massage_unbalanced_results():
    query = _make_query("statsPeriod=1d&interval=1d&field=sum(session)&groupBy=release")

    result_totals = [
        {"release": "test-example-release", "sessions": 1},
    ]
    result_timeseries = []

    expected_result = {
        "start": "2020-12-18T00:00:00Z",
        "end": "2020-12-18T11:15:00Z",
        "query": "",
        "intervals": ["2020-12-18T00:00:00Z"],
        "groups": [
            {
                "by": {"release": "test-example-release"},
                "series": {"sum(session)": [0]},
                "totals": {"sum(session)": 1},
            }
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result

    result_totals = []
    result_timeseries = [
        {
            "release": "test-example-release",
            "sessions": 1,
            "bucketed_started": "2020-12-18T00:00:00+00:00",
        },
    ]

    expected_result = {
        "start": "2020-12-18T00:00:00Z",
        "end": "2020-12-18T11:15:00Z",
        "query": "",
        "intervals": ["2020-12-18T00:00:00Z"],
        "groups": [
            {
                "by": {"release": "test-example-release"},
                "series": {"sum(session)": [1]},
                "totals": {"sum(session)": 0},
            }
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_massage_simple_timeseries():
    """A timeseries is filled up when it only receives partial data"""

    query = _make_query("statsPeriod=1d&interval=6h&field=sum(session)")
    result_totals = [{"sessions": 4}]
    # snuba returns the datetimes as strings for now
    result_timeseries = [
        {"sessions": 2, "bucketed_started": "2020-12-17T12:00:00+00:00"},
        {"sessions": 2, "bucketed_started": "2020-12-18T06:00:00+00:00"},
    ]

    expected_result = {
        "start": "2020-12-17T12:00:00Z",
        "end": "2020-12-18T11:15:00Z",
        "query": "",
        "intervals": [
            "2020-12-17T12:00:00Z",
            "2020-12-17T18:00:00Z",
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
        ],
        "groups": [
            {"by": {}, "series": {"sum(session)": [2, 0, 0, 2]}, "totals": {"sum(session)": 4}}
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


def test_massage_exact_timeseries():
    query = _make_query(
        "start=2020-12-17T15:12:34Z&end=2020-12-18T11:14:17Z&interval=6h&field=sum(session)"
    )
    result_totals = [{"sessions": 4}]
    result_timeseries = [
        {"sessions": 2, "bucketed_started": "2020-12-17T12:00:00+00:00"},
        {"sessions": 2, "bucketed_started": "2020-12-18T06:00:00+00:00"},
    ]

    expected_result = {
        "start": "2020-12-17T12:00:00Z",
        "end": "2020-12-18T12:00:00Z",
        "query": "",
        "intervals": [
            "2020-12-17T12:00:00Z",
            "2020-12-17T18:00:00Z",
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
        ],
        "groups": [
            {"by": {}, "series": {"sum(session)": [2, 0, 0, 2]}, "totals": {"sum(session)": 4}}
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_massage_groupby_timeseries():
    query = _make_query("statsPeriod=1d&interval=6h&field=sum(session)&groupBy=release")

    result_totals = [
        {"release": "test-example-release", "sessions": 4},
        {"release": "test-example-release-2", "sessions": 1},
    ]
    # snuba returns the datetimes as strings for now
    result_timeseries = [
        {
            "release": "test-example-release",
            "sessions": 2,
            "bucketed_started": "2020-12-17T12:00:00+00:00",
        },
        {
            "release": "test-example-release",
            "sessions": 2,
            "bucketed_started": "2020-12-18T06:00:00+00:00",
        },
        {
            "release": "test-example-release-2",
            "sessions": 1,
            "bucketed_started": "2020-12-18T06:00:00+00:00",
        },
    ]

    expected_result = {
        "start": "2020-12-17T12:00:00Z",
        "end": "2020-12-18T11:15:00Z",
        "query": "",
        "intervals": [
            "2020-12-17T12:00:00Z",
            "2020-12-17T18:00:00Z",
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
        ],
        "groups": [
            {
                "by": {"release": "test-example-release"},
                "series": {"sum(session)": [2, 0, 0, 2]},
                "totals": {"sum(session)": 4},
            },
            {
                "by": {"release": "test-example-release-2"},
                "series": {"sum(session)": [0, 0, 0, 1]},
                "totals": {"sum(session)": 1},
            },
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


@freeze_time("2020-12-18T13:25:15.769Z")
def test_massage_virtual_groupby_timeseries():
    query = _make_query(
        "statsPeriod=1d&interval=6h&field=sum(session)&field=count_unique(user)&groupBy=session.status"
    )
    result_totals = [
        {
            "users": 1,
            "users_crashed": 1,
            "sessions": 6,
            "sessions_errored": 1,
            "users_errored": 1,
            "sessions_abnormal": 0,
            "sessions_crashed": 1,
            "users_abnormal": 0,
        }
    ]
    # snuba returns the datetimes as strings for now
    result_timeseries = [
        {
            "sessions_errored": 1,
            "users": 1,
            "users_crashed": 1,
            "sessions_abnormal": 0,
            "sessions": 3,
            "users_errored": 1,
            "users_abnormal": 0,
            "sessions_crashed": 1,
            "bucketed_started": "2020-12-18T12:00:00+00:00",
        },
        {
            "sessions_errored": 0,
            "users": 1,
            "users_crashed": 0,
            "sessions_abnormal": 0,
            "sessions": 3,
            "users_errored": 0,
            "users_abnormal": 0,
            "sessions_crashed": 0,
            "bucketed_started": "2020-12-18T06:00:00+00:00",
        },
    ]

    expected_result = {
        "start": "2020-12-17T18:00:00Z",
        "end": "2020-12-18T13:26:00Z",
        "query": "",
        "intervals": [
            "2020-12-17T18:00:00Z",
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
            "2020-12-18T12:00:00Z",
        ],
        "groups": [
            {
                "by": {"session.status": "abnormal"},
                "series": {"count_unique(user)": [0, 0, 0, 0], "sum(session)": [0, 0, 0, 0]},
                "totals": {"count_unique(user)": 0, "sum(session)": 0},
            },
            {
                "by": {"session.status": "crashed"},
                "series": {"count_unique(user)": [0, 0, 0, 1], "sum(session)": [0, 0, 0, 1]},
                "totals": {"count_unique(user)": 1, "sum(session)": 1},
            },
            {
                "by": {"session.status": "errored"},
                "series": {"count_unique(user)": [0, 0, 0, 1], "sum(session)": [0, 0, 0, 1]},
                "totals": {"count_unique(user)": 1, "sum(session)": 1},
            },
            {
                "by": {"session.status": "healthy"},
                "series": {"count_unique(user)": [0, 0, 1, 0], "sum(session)": [0, 0, 3, 2]},
                # while in one of the time slots, we have a healthy user, it is
                # the *same* user as the one experiencing a crash later on,
                # so in the *whole* time window, that one user is not counted as healthy,
                # so the `0` here is expected, as thats an example of the `count_unique` behavior.
                "totals": {"count_unique(user)": 0, "sum(session)": 5},
            },
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_nan_duration():
    query = _make_query(
        "statsPeriod=1d&interval=6h&field=avg(session.duration)&field=p50(session.duration)"
    )

    result_totals = [
        {
            "duration_avg": math.nan,
            "duration_quantiles": [math.inf, math.inf, math.inf, math.inf, math.inf, math.inf],
        },
    ]
    result_timeseries = [
        {
            "duration_avg": math.nan,
            "duration_quantiles": [math.nan, math.nan, math.nan, math.nan, math.nan, math.nan],
            "bucketed_started": "2020-12-17T12:00:00+00:00",
        },
        {
            "duration_avg": math.inf,
            "duration_quantiles": [math.inf, math.inf, math.inf, math.inf, math.inf, math.inf],
            "bucketed_started": "2020-12-18T06:00:00+00:00",
        },
    ]

    expected_result = {
        "start": "2020-12-17T12:00:00Z",
        "end": "2020-12-18T11:15:00Z",
        "query": "",
        "intervals": [
            "2020-12-17T12:00:00Z",
            "2020-12-17T18:00:00Z",
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
        ],
        "groups": [
            {
                "by": {},
                "series": {
                    "avg(session.duration)": [None, None, None, None],
                    "p50(session.duration)": [None, None, None, None],
                },
                "totals": {"avg(session.duration)": None, "p50(session.duration)": None},
            },
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result
