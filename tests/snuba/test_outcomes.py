from django.http import QueryDict

from sentry.snuba.outcomes import QueryDefinition, massage_sessions_result
from sentry.testutils.helpers.datetime import freeze_time


def _make_query(qs, params=None):
    return QueryDefinition.from_query_dict(QueryDict(qs), params or {})


def result_sorted(result):
    """sort the groups of the results array by the `by` object, ensuring a stable order"""

    def stable_dict(d):
        return tuple(sorted(d.items(), key=lambda t: t[0]))

    result["groups"].sort(key=lambda group: stable_dict(group["by"]))
    return result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_massage_empty() -> None:
    query = _make_query("statsPeriod=1d&interval=1d&field=sum(quantity)&category=error")

    expected_result = {
        "end": "2020-12-19T00:00:00Z",
        "groups": [],
        "intervals": ["2020-12-17T00:00:00Z", "2020-12-18T00:00:00Z"],
        "query": [],
        "start": "2020-12-17T00:00:00Z",
    }

    actual_result = result_sorted(massage_sessions_result(query, [], []))

    assert actual_result == expected_result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_massage_unbalanced_results() -> None:
    query = _make_query(
        "statsPeriod=1d&interval=1d&field=sum(quantity)&groupBy=reason&category=error"
    )

    result_totals = [
        {"reason": "test-example-reason", "quantity": 1},
    ]

    expected_result = {
        "start": "2020-12-17T00:00:00Z",
        "end": "2020-12-19T00:00:00Z",
        "query": [],
        "intervals": ["2020-12-17T00:00:00Z", "2020-12-18T00:00:00Z"],
        "groups": [
            {
                "by": {"reason": "test-example-reason"},
                "series": {"sum(quantity)": [0, 0]},
                "totals": {"sum(quantity)": 1},
            }
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, []))

    assert actual_result == expected_result

    result_totals = []
    result_timeseries = [
        {
            "reason": "test-example-reason",
            "quantity": 1,
            "bucketed_started": "2020-12-18T00:00:00+00:00",
        },
    ]

    expected_result = {
        "start": "2020-12-17T00:00:00Z",
        "end": "2020-12-19T00:00:00Z",
        "query": [],
        "intervals": ["2020-12-17T00:00:00Z", "2020-12-18T00:00:00Z"],
        "groups": [
            {
                "by": {"reason": "test-example-reason"},
                "series": {"sum(quantity)": [0, 1]},
                "totals": {"sum(quantity)": 0},
            }
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_massage_simple_timeseries() -> None:
    """A timeseries is filled up when it only receives partial data"""

    query = _make_query("statsPeriod=1d&interval=6h&field=sum(quantity)&category=error")
    result_totals = [{"quantity": 4}]
    # snuba returns the datetimes as strings for now
    result_timeseries = [
        {"quantity": 2, "bucketed_started": "2020-12-18T06:00:00+00:00"},
        {"quantity": 2, "bucketed_started": "2020-12-17T12:00:00+00:00"},
    ]

    expected_result = {
        "start": "2020-12-17T06:00:00Z",
        "end": "2020-12-18T12:00:00Z",
        "query": [],
        "intervals": [
            "2020-12-17T06:00:00Z",
            "2020-12-17T12:00:00Z",
            "2020-12-17T18:00:00Z",
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
        ],
        "groups": [
            {"by": {}, "series": {"sum(quantity)": [0, 2, 0, 0, 2]}, "totals": {"sum(quantity)": 4}}
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_massage_unordered_timeseries() -> None:
    query = _make_query("statsPeriod=1d&interval=6h&field=sum(quantity)&category=error")
    result_totals = [{"quantity": 10}]
    # snuba returns the datetimes as strings for now
    result_timeseries = [
        {"quantity": 3, "bucketed_started": "2020-12-18T00:00:00+00:00"},
        {"quantity": 2, "bucketed_started": "2020-12-17T18:00:00+00:00"},
        {"quantity": 4, "bucketed_started": "2020-12-18T06:00:00+00:00"},
        {"quantity": 1, "bucketed_started": "2020-12-17T12:00:00+00:00"},
    ]

    expected_result = {
        "start": "2020-12-17T06:00:00Z",
        "end": "2020-12-18T12:00:00Z",
        "query": [],
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
                "series": {"sum(quantity)": [0, 1, 2, 3, 4]},
                "totals": {"sum(quantity)": 10},
            }
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_massage_no_timeseries() -> None:
    query = _make_query("statsPeriod=1d&interval=6h&field=sum(quantity)&category=error")
    result_totals = [{"quantity": 4}]
    # snuba returns the datetimes as strings for now
    result_timeseries = None

    expected_result = {
        "start": "2020-12-17T06:00:00Z",
        "end": "2020-12-18T12:00:00Z",
        "query": [],
        "intervals": [
            "2020-12-17T06:00:00Z",
            "2020-12-17T12:00:00Z",
            "2020-12-17T18:00:00Z",
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
        ],
        "groups": [{"by": {}, "totals": {"sum(quantity)": 4}}],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


def test_massage_exact_timeseries() -> None:
    query = _make_query(
        "start=2020-12-17T15:12:34Z&end=2020-12-18T11:14:17Z&interval=6h&field=sum(quantity)&category=error"
    )
    result_totals = [{"quantity": 4}]
    result_timeseries = [
        {"quantity": 2, "bucketed_started": "2020-12-18T06:00:00+00:00"},
        {"quantity": 2, "bucketed_started": "2020-12-17T12:00:00+00:00"},
    ]

    expected_result = {
        "start": "2020-12-17T12:00:00Z",
        "end": "2020-12-18T12:00:00Z",
        "query": [],
        "intervals": [
            "2020-12-17T12:00:00Z",
            "2020-12-17T18:00:00Z",
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
        ],
        "groups": [
            {"by": {}, "series": {"sum(quantity)": [2, 0, 0, 2]}, "totals": {"sum(quantity)": 4}}
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_massage_groupby_timeseries() -> None:
    query = _make_query(
        "statsPeriod=1d&interval=6h&field=sum(quantity)&groupBy=reason&category=error"
    )

    result_totals = [
        {"reason": "test-example-reason", "quantity": 4},
        {"reason": "test-example-reason-2", "quantity": 1},
    ]
    # snuba returns the datetimes as strings for now
    result_timeseries = [
        {
            "reason": "test-example-reason",
            "quantity": 2,
            "bucketed_started": "2020-12-18T06:00:00+00:00",
        },
        {
            "reason": "test-example-reason-2",
            "quantity": 1,
            "bucketed_started": "2020-12-18T06:00:00+00:00",
        },
        {
            "reason": "test-example-reason",
            "quantity": 2,
            "bucketed_started": "2020-12-17T12:00:00+00:00",
        },
    ]

    expected_result = {
        "start": "2020-12-17T06:00:00Z",
        "end": "2020-12-18T12:00:00Z",
        "query": [],
        "intervals": [
            "2020-12-17T06:00:00Z",
            "2020-12-17T12:00:00Z",
            "2020-12-17T18:00:00Z",
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
        ],
        "groups": [
            {
                "by": {"reason": "test-example-reason"},
                "series": {"sum(quantity)": [0, 2, 0, 0, 2]},
                "totals": {"sum(quantity)": 4},
            },
            {
                "by": {"reason": "test-example-reason-2"},
                "series": {"sum(quantity)": [0, 0, 0, 0, 1]},
                "totals": {"sum(quantity)": 1},
            },
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


@freeze_time("2020-12-18T13:25:15.769Z")
def test_massage_multiple_fields_groupby_timeseries() -> None:
    query = _make_query(
        "statsPeriod=1d&interval=6h&field=sum(quantity)&field=sum(times_seen)&groupBy=outcome&category=error"
    )
    result_totals = [
        {"outcome": "accepted", "quantity": 20, "times_seen": 10},
        {"outcome": "rate_limited", "quantity": 11, "times_seen": 5},
    ]
    # snuba returns the datetimes as strings for now
    result_timeseries = [
        {
            "bucketed_started": "2020-12-18T12:00:00+00:00",
            "outcome": "accepted",
            "quantity": 3,
            "times_seen": 1,
        },
        {
            "bucketed_started": "2020-12-18T06:00:00+00:00",
            "outcome": "accepted",
            "quantity": 3,
            "times_seen": 2,
        },
        {
            "bucketed_started": "2020-12-18T06:00:00+00:00",
            "outcome": "rate_limited",
            "quantity": 1,
            "times_seen": 1,
        },
        {
            "bucketed_started": "2020-12-18T00:00:00+00:00",
            "outcome": "accepted",
            "quantity": 10,
            "times_seen": 4,
        },
        {
            "bucketed_started": "2020-12-18T00:00:00+00:00",
            "outcome": "rate_limited",
            "quantity": 6,
            "times_seen": 3,
        },
        {
            "bucketed_started": "2020-12-17T18:00:00+00:00",
            "outcome": "accepted",
            "quantity": 4,
            "times_seen": 3,
        },
        {
            "bucketed_started": "2020-12-17T18:00:00+00:00",
            "outcome": "rate_limited",
            "quantity": 4,
            "times_seen": 1,
        },
    ]

    expected_result = {
        "start": "2020-12-17T12:00:00Z",
        "end": "2020-12-18T18:00:00Z",
        "query": [],
        "intervals": [
            "2020-12-17T12:00:00Z",
            "2020-12-17T18:00:00Z",
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
            "2020-12-18T12:00:00Z",
        ],
        "groups": [
            {
                "by": {"outcome": "accepted"},
                "series": {
                    "sum(quantity)": [0, 4, 10, 3, 3],
                    "sum(times_seen)": [0, 3, 4, 2, 1],
                },
                "totals": {"sum(quantity)": 20, "sum(times_seen)": 10},
            },
            {
                "by": {"outcome": "rate_limited"},
                "series": {
                    "sum(quantity)": [0, 4, 6, 1, 0],
                    "sum(times_seen)": [0, 1, 3, 1, 0],
                },
                "totals": {"sum(quantity)": 11, "sum(times_seen)": 5},
            },
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result


@freeze_time("2020-12-18T13:25:15.769Z")
def test_clamping_in_massage_sessions_results_with_groupby_timeseries() -> None:
    query = _make_query(
        "statsPeriod=12h&interval=6h&field=sum(quantity)&field=sum(times_seen)&groupBy=outcome&category=error"
    )
    # snuba returns the datetimes as strings for now
    result_timeseries = [
        {
            "bucketed_started": "2020-12-18T12:00:00+00:00",
            "outcome": "accepted",
            "quantity": 4,
            "times_seen": 4,
        },
        {
            "bucketed_started": "2020-12-18T12:00:00+00:00",
            "outcome": "rate_limited",
            "quantity": 2,
            "times_seen": 2,
        },
        {
            "bucketed_started": "2020-12-18T06:00:00+00:00",
            "outcome": "accepted",
            "quantity": 5,
            "times_seen": 5,
        },
        {
            "bucketed_started": "2020-12-18T06:00:00+00:00",
            "outcome": "rate_limited",
            "quantity": 10,
            "times_seen": 10,
        },
    ]
    expected_result = {
        "start": "2020-12-18T00:00:00Z",
        "end": "2020-12-18T18:00:00Z",
        "query": [],
        "intervals": [
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
            "2020-12-18T12:00:00Z",
        ],
        "groups": [
            {
                "by": {"outcome": "accepted"},
                "series": {"sum(quantity)": [0, 5, 4], "sum(times_seen)": [0, 5, 4]},
                "totals": {"sum(quantity)": 0, "sum(times_seen)": 0},
            },
            {
                "by": {"outcome": "rate_limited"},
                "series": {"sum(quantity)": [0, 10, 2], "sum(times_seen)": [0, 10, 2]},
                "totals": {"sum(quantity)": 0, "sum(times_seen)": 0},
            },
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, [], result_timeseries))

    assert actual_result == expected_result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_multiple_fields_timeseries() -> None:
    query = _make_query(
        "statsPeriod=1d&interval=6h&field=sum(quantity)&field=sum(times_seen)&category=error"
    )

    result_totals = [
        {"quantity": 10, "times_seen": 6},
    ]
    result_timeseries = [
        {"quantity": 4, "times_seen": 2, "bucketed_started": "2020-12-18T06:00:00+00:00"},
        {"quantity": 6, "times_seen": 4, "bucketed_started": "2020-12-17T12:00:00+00:00"},
    ]

    expected_result = {
        "start": "2020-12-17T06:00:00Z",
        "end": "2020-12-18T12:00:00Z",
        "query": [],
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
                    "sum(quantity)": [0, 6, 0, 0, 4],
                    "sum(times_seen)": [0, 4, 0, 0, 2],
                },
                "totals": {"sum(quantity)": 10, "sum(times_seen)": 6},
            },
        ],
    }

    actual_result = result_sorted(massage_sessions_result(query, result_totals, result_timeseries))

    assert actual_result == expected_result
