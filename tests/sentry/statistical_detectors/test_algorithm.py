from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Mapping

import pytest

from sentry.statistical_detectors.algorithm import (
    MovingAverageDetectorState,
    MovingAverageRelativeChangeDetector,
)
from sentry.statistical_detectors.base import DetectorPayload, TrendType
from sentry.utils.math import ExponentialMovingAverage


@pytest.mark.parametrize(
    ["state", "expected"],
    [
        pytest.param(
            MovingAverageDetectorState(
                timestamp=datetime(2023, 8, 31, 11, 28, 52),
                count=10,
                moving_avg_short=10,
                moving_avg_long=10,
            ),
            {
                MovingAverageDetectorState.FIELD_TIMESTAMP: int(
                    datetime(2023, 8, 31, 11, 28, 52).timestamp()
                ),
                MovingAverageDetectorState.FIELD_COUNT: 10,
                MovingAverageDetectorState.FIELD_MOVING_AVG_SHORT: 10,
                MovingAverageDetectorState.FIELD_MOVING_AVG_LONG: 10,
            },
            id="with timestamp",
        ),
        pytest.param(
            MovingAverageDetectorState(
                timestamp=None,
                count=10,
                moving_avg_short=10,
                moving_avg_long=10,
            ),
            {
                MovingAverageDetectorState.FIELD_COUNT: 10,
                MovingAverageDetectorState.FIELD_MOVING_AVG_SHORT: 10,
                MovingAverageDetectorState.FIELD_MOVING_AVG_LONG: 10,
            },
            id="without timestamp",
        ),
    ],
)
def test_moving_average_detector_state_to_redis_dict(state, expected):
    assert state.to_redis_dict() == expected


@pytest.mark.parametrize(
    ["data", "expected"],
    [
        pytest.param(
            {
                MovingAverageDetectorState.FIELD_TIMESTAMP: str(
                    int(datetime(2023, 8, 31, 11, 28, 52, tzinfo=timezone.utc).timestamp())
                ),
                MovingAverageDetectorState.FIELD_COUNT: "10",
                MovingAverageDetectorState.FIELD_MOVING_AVG_SHORT: "10",
                MovingAverageDetectorState.FIELD_MOVING_AVG_LONG: "10",
            },
            MovingAverageDetectorState(
                timestamp=datetime(2023, 8, 31, 11, 28, 52, tzinfo=timezone.utc),
                count=10,
                moving_avg_short=10,
                moving_avg_long=10,
            ),
            id="with timestamp",
        ),
        pytest.param(
            {
                MovingAverageDetectorState.FIELD_COUNT: "10",
                MovingAverageDetectorState.FIELD_MOVING_AVG_SHORT: "10",
                MovingAverageDetectorState.FIELD_MOVING_AVG_LONG: "10",
            },
            MovingAverageDetectorState(
                timestamp=None,
                count=10,
                moving_avg_short=10,
                moving_avg_long=10,
            ),
            id="without timestamp",
        ),
        pytest.param(
            {
                MovingAverageDetectorState.FIELD_COUNT: "10",
                MovingAverageDetectorState.FIELD_MOVING_AVG_SHORT: "10.0",
                MovingAverageDetectorState.FIELD_MOVING_AVG_LONG: "10.0",
            },
            MovingAverageDetectorState(
                timestamp=None,
                count=10,
                moving_avg_short=10,
                moving_avg_long=10,
            ),
            id="without timestamp",
        ),
    ],
)
def test_moving_average_detector_state_from_redis_dict(data, expected):
    assert MovingAverageDetectorState.from_redis_dict(data) == expected


@pytest.mark.parametrize(
    ["data", "error"],
    [
        pytest.param({}, KeyError, id="empty"),
        pytest.param(
            {
                MovingAverageDetectorState.FIELD_TIMESTAMP: "",
            },
            ValueError,
            id="bad timestamp",
        ),
        pytest.param(
            {
                MovingAverageDetectorState.FIELD_TIMESTAMP: str(
                    int(datetime(2023, 8, 31, 11, 28, 52).timestamp())
                ),
            },
            KeyError,
            id="missing count",
        ),
        pytest.param(
            {
                MovingAverageDetectorState.FIELD_TIMESTAMP: str(
                    int(datetime(2023, 8, 31, 11, 28, 52).timestamp())
                ),
                MovingAverageDetectorState.FIELD_COUNT: "",
            },
            ValueError,
            id="bad count",
        ),
        pytest.param(
            {
                MovingAverageDetectorState.FIELD_TIMESTAMP: str(
                    int(datetime(2023, 8, 31, 11, 28, 52).timestamp())
                ),
                MovingAverageDetectorState.FIELD_COUNT: "0",
            },
            KeyError,
            id="missing moving average short",
        ),
        pytest.param(
            {
                MovingAverageDetectorState.FIELD_TIMESTAMP: str(
                    int(datetime(2023, 8, 31, 11, 28, 52).timestamp())
                ),
                MovingAverageDetectorState.FIELD_COUNT: "0",
                MovingAverageDetectorState.FIELD_MOVING_AVG_SHORT: "",
            },
            ValueError,
            id="bad moving average short",
        ),
        pytest.param(
            {
                MovingAverageDetectorState.FIELD_TIMESTAMP: str(
                    int(datetime(2023, 8, 31, 11, 28, 52).timestamp())
                ),
                MovingAverageDetectorState.FIELD_COUNT: "0",
                MovingAverageDetectorState.FIELD_MOVING_AVG_SHORT: "0",
            },
            KeyError,
            id="missing moving average long",
        ),
        pytest.param(
            {
                MovingAverageDetectorState.FIELD_TIMESTAMP: str(
                    int(datetime(2023, 8, 31, 11, 28, 52).timestamp())
                ),
                MovingAverageDetectorState.FIELD_COUNT: "0",
                MovingAverageDetectorState.FIELD_MOVING_AVG_SHORT: "0",
                MovingAverageDetectorState.FIELD_MOVING_AVG_LONG: "",
            },
            ValueError,
            id="bad moving average long",
        ),
    ],
)
def test_moving_average_detector_state_from_redis_dict_error(data, error):
    with pytest.raises(error):
        MovingAverageDetectorState.from_redis_dict(data)


@pytest.mark.parametrize(
    ["baseline", "avg", "rel_threshold", "auto_resolve"],
    [
        pytest.param(100, 100, 0.1, True, id="equal"),
        pytest.param(100, 105, 0.1, True, id="within threshold above"),
        pytest.param(100, 95, 0.1, True, id="within threshold below"),
        pytest.param(100, 115, 0.1, False, id="exceed threshold above"),
        pytest.param(100, 85, 0.1, True, id="exceed threshold below"),
    ],
)
def test_moving_average_detector_state_should_auto_resolve(
    baseline, avg, rel_threshold, auto_resolve
):
    state = MovingAverageDetectorState(
        timestamp=datetime(2023, 8, 31, 11, 28, 52),
        count=10,
        moving_avg_short=avg,
        moving_avg_long=avg,
    )
    assert state.should_auto_resolve(baseline, rel_threshold) == auto_resolve


@pytest.mark.parametrize(
    ["baseline", "regressed", "avg", "min_change", "rel_threshold", "escalate"],
    [
        pytest.param(50, 100, 100, 10, 0.1, False, id="equal"),
        pytest.param(50, 100, 105, 10, 0.1, False, id="within threshold above"),
        pytest.param(50, 100, 95, 10, 0.1, False, id="within threshold below"),
        pytest.param(50, 100, 115, 10, 0.1, True, id="exceed threshold above"),
        pytest.param(50, 100, 85, 10, 0.1, False, id="exceed threshold below"),
        pytest.param(
            50, 100, 115, 20, 0.1, False, id="exceed threshold above but below min_change"
        ),
    ],
)
def test_moving_average_detector_state_should_escalate(
    baseline, regressed, avg, min_change, rel_threshold, escalate
):
    state = MovingAverageDetectorState(
        timestamp=datetime(2023, 8, 31, 11, 28, 52),
        count=10,
        moving_avg_short=avg,
        moving_avg_long=avg,
    )
    assert state.should_escalate(baseline, regressed, min_change, rel_threshold) == escalate


@pytest.mark.parametrize(
    ["min_data_points", "moving_avg_short_factory", "moving_avg_long_factory", "threshold"],
    [
        pytest.param(
            6,
            lambda: ExponentialMovingAverage(2 / 21),
            lambda: ExponentialMovingAverage(2 / 41),
            0.1,
        ),
    ],
)
@pytest.mark.parametrize(
    ["values", "regressed_indices", "improved_indices"],
    [
        pytest.param(
            [1 for _ in range(10)] + [2 for _ in range(10)],
            [12],
            [],
            id="stepwise increase",
        ),
        pytest.param(
            [2 for _ in range(10)] + [1 for _ in range(10)],
            [],
            [15],
            id="stepwise decrease",
        ),
        pytest.param(
            [(i / 10) ** 2 for i in range(-10, 20)],
            [24],
            [],
            id="quadratic increase",
        ),
        pytest.param(
            [-((i / 10) ** 2) for i in range(-10, 20)],
            [],
            [24],
            id="quadratic decrease",
        ),
    ],
)
def test_moving_average_relative_change_detector(
    min_data_points,
    moving_avg_long_factory,
    moving_avg_short_factory,
    threshold,
    values,
    regressed_indices,
    improved_indices,
):
    all_regressed = []
    all_improved = []

    now = datetime(2023, 8, 31, 11, 28, 52, tzinfo=timezone.utc)

    payloads = [
        DetectorPayload(
            project_id=1,
            group=0,
            fingerprint="0",
            count=i + 1,
            value=value,
            timestamp=now + timedelta(hours=i + 1),
        )
        for i, value in enumerate(values)
    ]

    detector = MovingAverageRelativeChangeDetector(
        "transaction",
        "endpoint",
        min_data_points=min_data_points,
        moving_avg_short_factory=moving_avg_short_factory,
        moving_avg_long_factory=moving_avg_long_factory,
        threshold=threshold,
    )

    raw_state: Mapping[str | bytes, bytes | float | int | str] = {}

    for payload in payloads:
        trend_type, score, state = detector.update(raw_state, payload)
        assert score >= 0
        if state is not None:
            raw_state = state.to_redis_dict()
        if trend_type == TrendType.Regressed:
            all_regressed.append(payload)
        elif trend_type == TrendType.Improved:
            all_improved.append(payload)

    assert all_regressed == [payloads[i] for i in regressed_indices]
    assert all_improved == [payloads[i] for i in improved_indices]
