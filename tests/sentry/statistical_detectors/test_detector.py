from datetime import datetime, timedelta

import pytest

from sentry.statistical_detectors.detector import (
    TrendPayload,
    TrendState,
    TrendType,
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
    "initial,values,regressed_indices,improved_indices",
    [
        pytest.param(
            TrendState(None, 0, 0, 0),
            [1 for _ in range(10)] + [2 for _ in range(10)],
            [10],
            [],
            id="stepwise increase",
        ),
        pytest.param(
            TrendState(None, 0, 0, 0),
            [2 for _ in range(10)] + [1 for _ in range(10)],
            [],
            [10],
            id="stepwise decrease",
        ),
        pytest.param(
            TrendState(None, 0, 0, 0),
            [(i / 10) ** 2 for i in range(-10, 20)],
            [23],
            [],
            id="quadratic increase",
        ),
        pytest.param(
            TrendState(None, 0, 0, 0),
            [-((i / 10) ** 2) for i in range(-10, 20)],
            [],
            [23],
            id="quadratic decrease",
        ),
    ],
)
def test_run_trend_detection(initial, values, regressed_indices, improved_indices):
    state: TrendState = initial
    all_regressed = []
    all_improved = []

    now = datetime.now()

    payloads = [
        TrendPayload(0, i + 1, value, now + timedelta(hours=i + 1))
        for i, value in enumerate(values)
    ]

    for payload in payloads:
        new_state = compute_new_trend_states(state, payload)
        assert new_state is not None
        state, (trend_type, result) = new_state
        if trend_type == TrendType.Regressed:
            all_regressed.append(result)
        elif trend_type == TrendType.Improved:
            all_improved.append(result)

    assert all_regressed == [payloads[i] for i in regressed_indices]
    assert all_improved == [payloads[i] for i in improved_indices]


def test_run_trend_detection_bad_order():
    now = datetime.now()

    state = TrendState(None, 0, 0, 0)

    new_state = compute_new_trend_states(state, TrendPayload(0, 2, 100, now))
    assert new_state is not None
    state, (trend_type, result) = new_state

    new_state = compute_new_trend_states(state, TrendPayload(0, 1, 100, now - timedelta(hours=1)))
    assert new_state is None
