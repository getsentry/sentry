import math

from django.http import QueryDict

from sentry.snuba.outcomes import massage_sessions_result
from sentry.snuba.sessions_v2 import QueryDefinition
from sentry.testutils.helpers.datetime import freeze_time


def _make_query(qs, params=None):
    return QueryDefinition(QueryDict(qs), params or {})


def result_sorted(result):
    """sort the groups of the results array by the `by` object, ensuring a stable order"""

    def stable_dict(d):
        return tuple(sorted(d.items(), key=lambda t: t[0]))

    result["groups"].sort(key=lambda group: stable_dict(group["by"]))
    return result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_massage_empty() -> None:
    query = _make_query("statsPeriod=1d&interval=1d&field=sum(session)")

    expected_result = {
        "end": "2020-12-19T00:00:00Z",
        "groups": [],
        "intervals": ["2020-12-17T00:00:00Z", "2020-12-18T00:00:00Z"],
        "query": "",
        "start": "2020-12-17T00:00:00Z",
    }

    actual_result = result_sorted(massage_sessions_result(query, [], []))

    assert actual_result == expected_result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_massage_unbalanced_results() -> None:
    query = _make_query("statsPeriod=1d&interval=1d&field=sum(session)&groupBy=release")

    result_totals = [
        {"release": "test-example-release", "sessions": 1},
    ]

    expected_result = {
        "start": "2020-12-17T00:00:00Z",
        "end": "2020-12-19T00:00:00Z",
        "query": "",
        "intervals": ["2020-12-17T00:00:00Z", "2020-12-18T00:00:00Z"],
        "groups": [
            {
                "by": {"release": "test-example-release"},
                "series": {"sum(session)": [0, 0]},
                "totals": {"sum(session)": 1},
            }
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, []))

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
        "start": "2020-12-17T00:00:00Z",
        "end": "2020-12-19T00:00:00Z",
        "query": "",
        "intervals": ["2020-12-17T00:00:00Z", "2020-12-18T00:00:00Z"],
        "groups": [
            {
                "by": {"release": "test-example-release"},
                "series": {"sum(session)": [0, 1]},
                "totals": {"sum(session)": 0},
            }
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_massage_simple_timeseries() -> None:
    """A timeseries is filled up when it only receives partial data"""

    query = _make_query("statsPeriod=1d&interval=6h&field=sum(session)")
    result_totals = [{"sessions": 4}]
    # snuba returns the datetimes as strings for now
    result_timeseries = [
        {"sessions": 2, "bucketed_started": "2020-12-18T06:00:00+00:00"},
        {"sessions": 2, "bucketed_started": "2020-12-17T12:00:00+00:00"},
    ]

    expected_result = {
        "start": "2020-12-17T06:00:00Z",
        "end": "2020-12-18T12:00:00Z",
        "query": "",
        "intervals": [
            "2020-12-17T06:00:00Z",
            "2020-12-17T12:00:00Z",
            "2020-12-17T18:00:00Z",
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
        ],
        "groups": [
            {"by": {}, "series": {"sum(session)": [0, 2, 0, 0, 2]}, "totals": {"sum(session)": 4}}
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_massage_unordered_timeseries() -> None:
    query = _make_query("statsPeriod=1d&interval=6h&field=sum(session)")
    result_totals = [{"sessions": 10}]
    # snuba returns the datetimes as strings for now
    result_timeseries = [
        {"sessions": 3, "bucketed_started": "2020-12-18T00:00:00+00:00"},
        {"sessions": 2, "bucketed_started": "2020-12-17T18:00:00+00:00"},
        {"sessions": 4, "bucketed_started": "2020-12-18T06:00:00+00:00"},
        {"sessions": 1, "bucketed_started": "2020-12-17T12:00:00+00:00"},
    ]

    expected_result = {
        "start": "2020-12-17T06:00:00Z",
        "end": "2020-12-18T12:00:00Z",
        "query": "",
        "intervals": [
            "2020-12-17T06:00:00Z",
            "2020-12-17T12:00:00Z",
            "2020-12-17T18:00:00Z",
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
        ],
        "groups": [
            {"by": {}, "series": {"sum(session)": [0, 1, 2, 3, 4]}, "totals": {"sum(session)": 10}}
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_massage_no_timeseries() -> None:
    query = _make_query("statsPeriod=1d&interval=6h&field=sum(session)&groupby=projects")
    result_totals = [{"sessions": 4}]
    # snuba returns the datetimes as strings for now
    result_timeseries = None

    expected_result = {
        "start": "2020-12-17T06:00:00Z",
        "end": "2020-12-18T12:00:00Z",
        "query": "",
        "intervals": [
            "2020-12-17T06:00:00Z",
            "2020-12-17T12:00:00Z",
            "2020-12-17T18:00:00Z",
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
        ],
        "groups": [{"by": {}, "totals": {"sum(session)": 4}}],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


def test_massage_exact_timeseries() -> None:
    query = _make_query(
        "start=2020-12-17T15:12:34Z&end=2020-12-18T11:14:17Z&interval=6h&field=sum(session)"
    )
    result_totals = [{"sessions": 4}]
    result_timeseries = [
        {"sessions": 2, "bucketed_started": "2020-12-18T06:00:00+00:00"},
        {"sessions": 2, "bucketed_started": "2020-12-17T12:00:00+00:00"},
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
def test_massage_groupby_timeseries() -> None:
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
            "bucketed_started": "2020-12-18T06:00:00+00:00",
        },
        {
            "release": "test-example-release-2",
            "sessions": 1,
            "bucketed_started": "2020-12-18T06:00:00+00:00",
        },
        {
            "release": "test-example-release",
            "sessions": 2,
            "bucketed_started": "2020-12-17T12:00:00+00:00",
        },
    ]

    expected_result = {
        "start": "2020-12-17T06:00:00Z",
        "end": "2020-12-18T12:00:00Z",
        "query": "",
        "intervals": [
            "2020-12-17T06:00:00Z",
            "2020-12-17T12:00:00Z",
            "2020-12-17T18:00:00Z",
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
        ],
        "groups": [
            {
                "by": {"release": "test-example-release"},
                "series": {"sum(session)": [0, 2, 0, 0, 2]},
                "totals": {"sum(session)": 4},
            },
            {
                "by": {"release": "test-example-release-2"},
                "series": {"sum(session)": [0, 0, 0, 0, 1]},
                "totals": {"sum(session)": 1},
            },
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


@freeze_time("2020-12-18T13:25:15.769Z")
def test_massage_virtual_groupby_timeseries() -> None:
    query = _make_query(
        "statsPeriod=1d&interval=6h&field=sum(session)&field=count_unique(user)&groupBy=session.status"
    )
    result_totals = [
        {
            "sessions_abnormal": 6,
            "sessions_crashed": 8,
            "sessions_errored": 15,
            "sessions_unhandled": 0,
            "sessions": 31,
            "users_abnormal": 0,
            "users_crashed": 1,
            "users_errored": 1,
            "users_unhandled": 4,
            "users": 5,
        }
    ]
    # snuba returns the datetimes as strings for now
    result_timeseries = [
        {
            "bucketed_started": "2020-12-18T12:00:00+00:00",
            "sessions_abnormal": 0,
            "sessions_crashed": 1,
            "sessions_errored": 1,
            "sessions_unhandled": 0,
            "sessions": 3,
            "users_abnormal": 0,
            "users_crashed": 1,
            "users_errored": 1,
            "users_unhandled": 0,
            "users": 1,
        },
        {
            "bucketed_started": "2020-12-18T06:00:00+00:00",
            "sessions_abnormal": 0,
            "sessions_crashed": 0,
            "sessions_errored": 0,
            "sessions_unhandled": 0,
            "sessions": 3,
            "users_abnormal": 0,
            "users_crashed": 0,
            "users_errored": 0,
            "users_unhandled": 1,
            "users": 2,
        },
        {
            "bucketed_started": "2020-12-18T00:00:00+00:00",
            "sessions_abnormal": 2,
            "sessions_crashed": 4,
            "sessions_errored": 10,
            "sessions_unhandled": 0,
            "sessions": 15,
            "users_abnormal": 0,
            "users_crashed": 0,
            "users_errored": 0,
            "users_unhandled": 3,
            "users": 4,
        },
        {
            "bucketed_started": "2020-12-17T18:00:00+00:00",
            "sessions_abnormal": 4,
            "sessions_crashed": 3,
            "sessions_errored": 4,
            "sessions_unhandled": 0,
            "sessions": 10,
            "users_abnormal": 0,
            "users_crashed": 0,
            "users_errored": 0,
            "users_unhandled": 0,
            "users": 1,
        },
    ]

    expected_result = {
        "start": "2020-12-17T12:00:00Z",
        "end": "2020-12-18T18:00:00Z",
        "query": "",
        "intervals": [
            "2020-12-17T12:00:00Z",
            "2020-12-17T18:00:00Z",
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
            "2020-12-18T12:00:00Z",
        ],
        "groups": [
            {
                "by": {"session.status": "abnormal"},
                "series": {"count_unique(user)": [0, 0, 0, 0, 0], "sum(session)": [0, 4, 2, 0, 0]},
                "totals": {"count_unique(user)": 0, "sum(session)": 6},
            },
            {
                "by": {"session.status": "crashed"},
                "series": {"count_unique(user)": [0, 0, 0, 0, 1], "sum(session)": [0, 3, 4, 0, 1]},
                "totals": {"count_unique(user)": 1, "sum(session)": 8},
            },
            {
                "by": {"session.status": "errored"},
                "series": {"count_unique(user)": [0, 0, 0, 0, 0], "sum(session)": [0, 0, 4, 0, 0]},
                "totals": {"count_unique(user)": 0, "sum(session)": 1},
            },
            {
                "by": {"session.status": "healthy"},
                "series": {"count_unique(user)": [0, 1, 1, 1, 0], "sum(session)": [0, 6, 5, 3, 2]},
                # while in one of the time slots, we have a healthy user, it is
                # the *same* user as the one experiencing a crash later on,
                # so in the *whole* time window, that one user is not counted as healthy,
                # so the `0` here is expected, as that's an example of the `count_unique` behavior.
                "totals": {"count_unique(user)": 0, "sum(session)": 16},
            },
            {
                "by": {"session.status": "unhandled"},
                "series": {"count_unique(user)": [0, 0, 3, 1, 0], "sum(session)": [0, 0, 0, 0, 0]},
                "totals": {"count_unique(user)": 4, "sum(session)": 0},
            },
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


@freeze_time("2020-12-18T13:25:15.769Z")
def test_clamping_in_massage_sessions_results_with_groupby_timeseries() -> None:
    query = _make_query(
        "statsPeriod=12h&interval=6h&field=sum(session)&field=count_unique(user)&groupBy=session.status"
    )
    # snuba returns the datetimes as strings for now
    result_timeseries = [
        {
            "bucketed_started": "2020-12-18T12:00:00+00:00",
            "sessions_abnormal": 2,
            "sessions_crashed": 2,
            "sessions_errored": 3,
            "sessions_unhandled": 0,
            "sessions": 7,
            "users_abnormal": 2,
            "users_crashed": 2,
            "users_errored": 3,
            "users_unhandled": 0,
            "users": 7,
        },
        {
            "bucketed_started": "2020-12-18T06:00:00+00:00",
            "sessions_abnormal": 0,
            "sessions_crashed": 0,
            "sessions_errored": 10,
            "sessions_unhandled": 0,
            "sessions": 5,
            "users_abnormal": 0,
            "users_crashed": 0,
            "users_errored": 10,
            "users_unhandled": 0,
            "users": 5,
        },
    ]
    expected_result = {
        "start": "2020-12-18T00:00:00Z",
        "end": "2020-12-18T18:00:00Z",
        "query": "",
        "intervals": [
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
            "2020-12-18T12:00:00Z",
        ],
        "groups": [
            {
                "by": {"session.status": "abnormal"},
                "series": {"count_unique(user)": [0, 0, 2], "sum(session)": [0, 0, 2]},
                "totals": {"count_unique(user)": 0, "sum(session)": 0},
            },
            {
                "by": {"session.status": "crashed"},
                "series": {"count_unique(user)": [0, 0, 2], "sum(session)": [0, 0, 2]},
                "totals": {"count_unique(user)": 0, "sum(session)": 0},
            },
            {
                "by": {"session.status": "errored"},
                "series": {"count_unique(user)": [0, 10, 0], "sum(session)": [0, 10, 0]},
                "totals": {"count_unique(user)": 0, "sum(session)": 0},
            },
            {
                "by": {"session.status": "healthy"},
                "series": {"count_unique(user)": [0, 0, 4], "sum(session)": [0, 0, 4]},
                "totals": {"count_unique(user)": 0, "sum(session)": 0},
            },
            {
                "by": {"session.status": "unhandled"},
                "series": {"count_unique(user)": [0, 0, 0], "sum(session)": [0, 0, 0]},
                "totals": {"count_unique(user)": 0, "sum(session)": 0},
            },
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, [], result_timeseries))

    assert actual_result == expected_result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_nan_duration() -> None:
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
            "duration_avg": math.inf,
            "duration_quantiles": [math.inf, math.inf, math.inf, math.inf, math.inf, math.inf],
            "bucketed_started": "2020-12-18T06:00:00+00:00",
        },
        {
            "duration_avg": math.nan,
            "duration_quantiles": [math.nan, math.nan, math.nan, math.nan, math.nan, math.nan],
            "bucketed_started": "2020-12-17T12:00:00+00:00",
        },
    ]

    expected_result = {
        "start": "2020-12-17T06:00:00Z",
        "end": "2020-12-18T12:00:00Z",
        "query": "",
        "intervals": [
            "2020-12-17T06:00:00Z",
            "2020-12-17T12:00:00Z",
            "2020-12-17T18:00:00Z",
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
        ],
        "groups": [
            {
                "by": {},
                "series": {
                    "avg(session.duration)": [None, None, None, None, None],
                    "p50(session.duration)": [None, None, None, None, None],
                },
                "totals": {"avg(session.duration)": None, "p50(session.duration)": None},
            },
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result
