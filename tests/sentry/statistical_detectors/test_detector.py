from datetime import datetime

import pytest

from sentry.statistical_detectors.detector import TrendState


@pytest.mark.parametrize(
    "data,expected",
    [
        pytest.param(
            {},
            {
                TrendState.FIELD_VERSION: 1,
                TrendState.FIELD_COUNT: 0,
                TrendState.FIELD_SHORT_TERM: 0,
                TrendState.FIELD_LONG_TERM: 0,
            },
            id="empty dict",
        ),
        pytest.param(
            {
                TrendState.FIELD_VERSION: "1",
                TrendState.FIELD_COUNT: "1",
                TrendState.FIELD_SHORT_TERM: "2",
                TrendState.FIELD_LONG_TERM: "3",
                TrendState.FIELD_TIMESTAMP: datetime(2023, 8, 9, 14, 17).isoformat(),
            },
            {
                TrendState.FIELD_VERSION: 1,
                TrendState.FIELD_COUNT: 1,
                TrendState.FIELD_SHORT_TERM: 2,
                TrendState.FIELD_LONG_TERM: 3,
                TrendState.FIELD_TIMESTAMP: datetime(2023, 8, 9, 14, 17).isoformat(),
            },
            id="with timestamp",
        ),
        pytest.param(
            {
                TrendState.FIELD_VERSION: "1",
                TrendState.FIELD_COUNT: "1",
                TrendState.FIELD_SHORT_TERM: "2",
                TrendState.FIELD_LONG_TERM: "3",
            },
            {
                TrendState.FIELD_VERSION: 1,
                TrendState.FIELD_COUNT: 1,
                TrendState.FIELD_SHORT_TERM: 2,
                TrendState.FIELD_LONG_TERM: 3,
            },
            id="no timestamp",
        ),
        pytest.param(
            {
                TrendState.FIELD_COUNT: "1",
                TrendState.FIELD_SHORT_TERM: "2",
                TrendState.FIELD_LONG_TERM: "3",
            },
            {
                TrendState.FIELD_VERSION: 1,
                TrendState.FIELD_COUNT: 0,
                TrendState.FIELD_SHORT_TERM: 0,
                TrendState.FIELD_LONG_TERM: 0,
            },
            id="no version",
        ),
        pytest.param(
            {
                TrendState.FIELD_COUNT: "x",
                TrendState.FIELD_SHORT_TERM: "2",
                TrendState.FIELD_LONG_TERM: "3",
            },
            {
                TrendState.FIELD_VERSION: 1,
                TrendState.FIELD_COUNT: 0,
                TrendState.FIELD_SHORT_TERM: 0,
                TrendState.FIELD_LONG_TERM: 0,
            },
            id="bad version",
        ),
        pytest.param(
            {
                TrendState.FIELD_VERSION: "1",
                TrendState.FIELD_COUNT: "foo",
                TrendState.FIELD_SHORT_TERM: "bar",
                TrendState.FIELD_LONG_TERM: "baz",
                TrendState.FIELD_TIMESTAMP: "qux",
            },
            {
                TrendState.FIELD_VERSION: 1,
                TrendState.FIELD_COUNT: 0,
                TrendState.FIELD_SHORT_TERM: 0,
                TrendState.FIELD_LONG_TERM: 0,
            },
            id="bad values",
        ),
    ],
)
def test_trend_state(data, expected):
    state = TrendState.from_dict(data)
    d = state.as_dict()
    assert d == expected
