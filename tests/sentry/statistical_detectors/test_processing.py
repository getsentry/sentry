from datetime import datetime, timedelta
from unittest.mock import MagicMock

import pytest

from sentry.statistical_detectors.detector import TrendPayload, TrendState, TrendType
from sentry.statistical_detectors.processing import compute_new_trend_states, process_trend_payloads
from sentry.testutils.pytest.fixtures import django_db_all


@pytest.fixture
def project():
    project = MagicMock()
    project.id = 1
    project.organization_id = 1
    return project


@pytest.mark.parametrize(
    "values,regressed_indices,improved_indices",
    [
        pytest.param(
            [1 for _ in range(10)] + [2 for _ in range(10)],
            [10],
            [],
            id="stepwise increase",
        ),
        pytest.param(
            [2 for _ in range(10)] + [1 for _ in range(10)],
            [],
            [10],
            id="stepwise decrease",
        ),
        pytest.param(
            [(i / 10) ** 2 for i in range(-10, 20)],
            [23],
            [],
            id="quadratic increase",
        ),
        pytest.param(
            [-((i / 10) ** 2) for i in range(-10, 20)],
            [],
            [23],
            id="quadratic decrease",
        ),
    ],
)
@django_db_all
def test_process_trend_payloads(reset_snuba, project, values, regressed_indices, improved_indices):
    all_regressed = []
    all_improved = []

    now = datetime.now()

    payloads = [
        TrendPayload(0, i + 1, value, now + timedelta(hours=i + 1))
        for i, value in enumerate(values)
    ]

    for payload in payloads:
        regressed, improved = process_trend_payloads(project, [payload])
        all_regressed.extend(regressed)
        all_improved.extend(improved)

    assert all_regressed == [payloads[i] for i in regressed_indices]
    assert all_improved == [payloads[i] for i in improved_indices]


def test_compute_new_trend_states_bad_payload_order():
    now = datetime.now()

    state = TrendState(None, 0, 0, 0)

    new_state = compute_new_trend_states(state, TrendPayload(0, 2, 100, now))
    assert new_state is not None
    state, trend_type = new_state
    assert state is not None
    assert trend_type == TrendType.Unchanged

    new_state = compute_new_trend_states(state, TrendPayload(0, 1, 100, now - timedelta(hours=1)))
    assert new_state is None
