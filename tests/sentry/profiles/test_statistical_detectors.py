from datetime import datetime, timedelta

import pytest

from sentry.profiles.statistical_detectors import (
    FunctionPayload,
    TrendState,
    compute_new_trend_states,
)


@pytest.mark.parametrize(
    "data,expected",
    [
        pytest.param(
            {},
            {
                TrendState.FIELD_COUNT: 0,
                TrendState.FIELD_SHORT_TERM: 0,
                TrendState.FIELD_LONG_TERM: 0,
            },
            id="empty dict",
        ),
        pytest.param(
            {
                TrendState.FIELD_COUNT: "1",
                TrendState.FIELD_SHORT_TERM: "2",
                TrendState.FIELD_LONG_TERM: "3",
                TrendState.FIELD_TIMESTAMP: datetime(2023, 8, 9, 14, 17).isoformat(),
            },
            {
                TrendState.FIELD_COUNT: 1,
                TrendState.FIELD_SHORT_TERM: 2,
                TrendState.FIELD_LONG_TERM: 3,
                TrendState.FIELD_TIMESTAMP: datetime(2023, 8, 9, 14, 17).isoformat(),
            },
            id="with timestamp",
        ),
        pytest.param(
            {
                TrendState.FIELD_COUNT: "1",
                TrendState.FIELD_SHORT_TERM: "2",
                TrendState.FIELD_LONG_TERM: "3",
            },
            {
                TrendState.FIELD_COUNT: 1,
                TrendState.FIELD_SHORT_TERM: 2,
                TrendState.FIELD_LONG_TERM: 3,
            },
            id="no timestamp",
        ),
        pytest.param(
            {
                TrendState.FIELD_COUNT: "foo",
                TrendState.FIELD_SHORT_TERM: "bar",
                TrendState.FIELD_LONG_TERM: "baz",
                TrendState.FIELD_TIMESTAMP: "qux",
            },
            {
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


@pytest.mark.parametrize(
    "initial,p95s,breakpoints",
    [
        pytest.param(
            TrendState(None, 0, 0, 0),
            [1 for _ in range(10)] + [2 for _ in range(10)],
            [10],
            id="sudden increase",
        ),
        pytest.param(
            TrendState(None, 0, 0, 0),
            [(i / 10) ** 2 for i in range(-10, 20)],
            [23],
            id="quadratic increase",
        ),
    ],
)
def test_run_regressed_functions_detection(initial, p95s, breakpoints):
    states = [initial]
    all_regressed = []

    now = datetime.now()

    payloads = [
        FunctionPayload(0, i + 1, p95, now + timedelta(hours=i + 1)) for i, p95 in enumerate(p95s)
    ]

    for payload in payloads:
        new_states, regressed, _ = compute_new_trend_states(1, states, [payload])
        states = [state for _, state in new_states]
        all_regressed.extend(regressed)

    assert all_regressed == [payloads[i] for i in breakpoints]
