from freezegun import freeze_time
from django.http import QueryDict

# from sentry.testutils import TestCase
from sentry.snuba.sessions_v2 import (
    QueryDefinition,
    massage_sessions_result,
    _get_timestamps,
)


def _make_query(qs):
    return QueryDefinition(QueryDict(qs), [])


def result_sorted(result):
    """sort the groups of the results array by the `by` object, ensuring a stable order"""

    def stable_dict(d):
        return tuple(sorted(d.items(), key=lambda t: t[0]))

    result["groups"].sort(key=lambda group: stable_dict(group["by"]))
    return result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_timestamps():
    query = _make_query("statsPeriod=1d&interval=12h&field=sum(session)")

    expected_timestamps = ["2020-12-17T12:00:00Z", "2020-12-18T00:00:00Z"]
    actual_timestamps = _get_timestamps(query)

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
