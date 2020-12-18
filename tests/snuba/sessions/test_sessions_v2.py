from __future__ import absolute_import

from freezegun import freeze_time
from django.http import QueryDict

# from sentry.testutils import TestCase
from sentry.snuba.sessions_v2 import (
    massage_sessions_result,
    _get_query_from_request,
    _get_timestamps,
)


class MockRequest(object):
    def __init__(self, qs):
        self.GET = QueryDict(qs)


@freeze_time("2020-12-18T11:14:17.105Z")
def test_timestamps():
    query = _get_query_from_request(MockRequest("statsPeriod=1d&interval=12h"))

    expected_timestamps = ["2020-12-17T00:00:00Z", "2020-12-17T12:00:00Z", "2020-12-18T00:00:00Z"]
    actual_timestamps = _get_timestamps(query)

    assert actual_timestamps == expected_timestamps


@freeze_time("2020-12-18T11:14:17.105Z")
def test_massage_simple_timeseries():
    """A timeseries is filled up when it only receives partial data"""

    query = _get_query_from_request(MockRequest("statsPeriod=1d&interval=6h&field=sum(session)"))
    result_totals = [{"sessions": 4}]
    # snuba returns the datetimes as strings for now
    result_timeseries = [
        {"sessions": 2, "bucketed_started": "2020-12-17T12:00:00+00:00"},
        {"sessions": 2, "bucketed_started": "2020-12-18T06:00:00+00:00"},
    ]

    expected_result = {
        "intervals": [
            "2020-12-17T06:00:00Z",
            "2020-12-17T12:00:00Z",
            "2020-12-17T18:00:00Z",
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
        ],
        "groups": [
            {"series": {"sum(session)": [0, 2, 0, 0, 2]}, "by": {}, "totals": {"sum(session)": 4}}
        ],
    }

    actual_result = massage_sessions_result(query, result_totals, result_timeseries)

    assert actual_result == expected_result


@freeze_time("2020-12-18T11:14:17.105Z")
def test_massage_groupby_timeseries():
    """A timeseries is filled up when it only receives partial data"""

    query = _get_query_from_request(
        MockRequest("statsPeriod=1d&interval=6h&field=sum(session)&groupBy=release")
    )
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
        "intervals": [
            "2020-12-17T06:00:00Z",
            "2020-12-17T12:00:00Z",
            "2020-12-17T18:00:00Z",
            "2020-12-18T00:00:00Z",
            "2020-12-18T06:00:00Z",
        ],
        "groups": [
            {
                "series": {"sum(session)": [0, 2, 0, 0, 2]},
                "by": {"release": "test-example-release"},
                "totals": {"sum(session)": 4},
            },
            {
                "series": {"sum(session)": [0, 0, 0, 0, 1]},
                "by": {"release": "test-example-release-2"},
                "totals": {"sum(session)": 1},
            },
        ],
    }

    actual_result = massage_sessions_result(query, result_totals, result_timeseries)

    assert actual_result == expected_result
