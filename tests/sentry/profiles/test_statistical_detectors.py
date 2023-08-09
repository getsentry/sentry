from datetime import datetime, timedelta

import pytest

from sentry.profiles.statistical_detectors import (
    FunctionPayload,
    RegressionState,
    compute_new_regression_states,
)


@pytest.mark.parametrize(
    "initial,p95s,breakpoints",
    [
        pytest.param(
            RegressionState(None, 0, 0, 0),
            [1 for _ in range(10)] + [2 for _ in range(10)],
            [10],
            id="sudden increase",
        ),
        pytest.param(
            RegressionState(None, 0, 0, 0),
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
        new_states, regressed = compute_new_regression_states(1, states, [payload])
        states = [state for _, state in new_states]
        all_regressed.extend(regressed)

    assert all_regressed == [payloads[i] for i in breakpoints]
