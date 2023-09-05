from datetime import datetime, timedelta, timezone

import pytest

from sentry.statistical_detectors.algorithm import (
    MovingAverageCrossOverDetector,
    MovingAverageCrossOverDetectorConfig,
    MovingAverageCrossOverDetectorState,
)
from sentry.statistical_detectors.detector import DetectorPayload, TrendType
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.math import ExponentialMovingAverage


@pytest.mark.parametrize(
    ["state", "expected"],
    [
        pytest.param(
            MovingAverageCrossOverDetectorState(
                timestamp=datetime(2023, 8, 31, 11, 28, 52),
                count=10,
                moving_avg_short=10,
                moving_avg_long=10,
            ),
            {
                MovingAverageCrossOverDetectorState.FIELD_TIMESTAMP: int(
                    datetime(2023, 8, 31, 11, 28, 52).timestamp()
                ),
                MovingAverageCrossOverDetectorState.FIELD_COUNT: 10,
                MovingAverageCrossOverDetectorState.FIELD_MOVING_AVG_SHORT: 10,
                MovingAverageCrossOverDetectorState.FIELD_MOVING_AVG_LONG: 10,
            },
            id="with timestamp",
        ),
        pytest.param(
            MovingAverageCrossOverDetectorState(
                timestamp=None,
                count=10,
                moving_avg_short=10,
                moving_avg_long=10,
            ),
            {
                MovingAverageCrossOverDetectorState.FIELD_COUNT: 10,
                MovingAverageCrossOverDetectorState.FIELD_MOVING_AVG_SHORT: 10,
                MovingAverageCrossOverDetectorState.FIELD_MOVING_AVG_LONG: 10,
            },
            id="without timestamp",
        ),
    ],
)
def test_moving_average_cross_over_detector_state_to_redis_dict(state, expected):
    assert state.to_redis_dict() == expected


@pytest.mark.parametrize(
    ["data", "expected"],
    [
        pytest.param(
            {
                MovingAverageCrossOverDetectorState.FIELD_TIMESTAMP: str(
                    int(datetime(2023, 8, 31, 11, 28, 52, tzinfo=timezone.utc).timestamp())
                ),
                MovingAverageCrossOverDetectorState.FIELD_COUNT: "10",
                MovingAverageCrossOverDetectorState.FIELD_MOVING_AVG_SHORT: "10",
                MovingAverageCrossOverDetectorState.FIELD_MOVING_AVG_LONG: "10",
            },
            MovingAverageCrossOverDetectorState(
                timestamp=datetime(2023, 8, 31, 11, 28, 52, tzinfo=timezone.utc),
                count=10,
                moving_avg_short=10,
                moving_avg_long=10,
            ),
            id="with timestamp",
        ),
        pytest.param(
            {
                MovingAverageCrossOverDetectorState.FIELD_COUNT: "10",
                MovingAverageCrossOverDetectorState.FIELD_MOVING_AVG_SHORT: "10",
                MovingAverageCrossOverDetectorState.FIELD_MOVING_AVG_LONG: "10",
            },
            MovingAverageCrossOverDetectorState(
                timestamp=None,
                count=10,
                moving_avg_short=10,
                moving_avg_long=10,
            ),
            id="without timestamp",
        ),
    ],
)
def test_moving_average_cross_over_detector_state_from_redis_dict(data, expected):
    assert MovingAverageCrossOverDetectorState.from_redis_dict(data) == expected


@pytest.mark.parametrize(
    ["data", "error"],
    [
        pytest.param({}, KeyError, id="empty"),
        pytest.param(
            {
                MovingAverageCrossOverDetectorState.FIELD_TIMESTAMP: "",
            },
            ValueError,
            id="bad timestamp",
        ),
        pytest.param(
            {
                MovingAverageCrossOverDetectorState.FIELD_TIMESTAMP: str(
                    int(datetime(2023, 8, 31, 11, 28, 52).timestamp())
                ),
            },
            KeyError,
            id="missing count",
        ),
        pytest.param(
            {
                MovingAverageCrossOverDetectorState.FIELD_TIMESTAMP: str(
                    int(datetime(2023, 8, 31, 11, 28, 52).timestamp())
                ),
                MovingAverageCrossOverDetectorState.FIELD_COUNT: "",
            },
            ValueError,
            id="bad count",
        ),
        pytest.param(
            {
                MovingAverageCrossOverDetectorState.FIELD_TIMESTAMP: str(
                    int(datetime(2023, 8, 31, 11, 28, 52).timestamp())
                ),
                MovingAverageCrossOverDetectorState.FIELD_COUNT: "0",
            },
            KeyError,
            id="missing moving average short",
        ),
        pytest.param(
            {
                MovingAverageCrossOverDetectorState.FIELD_TIMESTAMP: str(
                    int(datetime(2023, 8, 31, 11, 28, 52).timestamp())
                ),
                MovingAverageCrossOverDetectorState.FIELD_COUNT: "0",
                MovingAverageCrossOverDetectorState.FIELD_MOVING_AVG_SHORT: "",
            },
            ValueError,
            id="bad moving average short",
        ),
        pytest.param(
            {
                MovingAverageCrossOverDetectorState.FIELD_TIMESTAMP: str(
                    int(datetime(2023, 8, 31, 11, 28, 52).timestamp())
                ),
                MovingAverageCrossOverDetectorState.FIELD_COUNT: "0",
                MovingAverageCrossOverDetectorState.FIELD_MOVING_AVG_SHORT: "0",
            },
            KeyError,
            id="missing moving average long",
        ),
        pytest.param(
            {
                MovingAverageCrossOverDetectorState.FIELD_TIMESTAMP: str(
                    int(datetime(2023, 8, 31, 11, 28, 52).timestamp())
                ),
                MovingAverageCrossOverDetectorState.FIELD_COUNT: "0",
                MovingAverageCrossOverDetectorState.FIELD_MOVING_AVG_SHORT: "0",
                MovingAverageCrossOverDetectorState.FIELD_MOVING_AVG_LONG: "",
            },
            ValueError,
            id="bad moving average long",
        ),
    ],
)
def test_moving_average_cross_over_detector_state_from_redis_dict_error(data, error):
    with pytest.raises(error):
        MovingAverageCrossOverDetectorState.from_redis_dict(data)


@pytest.mark.parametrize(
    ["min_data_points", "short_moving_avg_factory", "long_moving_avg_factory"],
    [
        pytest.param(
            6,
            lambda: ExponentialMovingAverage(2 / 21),
            lambda: ExponentialMovingAverage(2 / 41),
        ),
    ],
)
@pytest.mark.parametrize(
    ["values", "regressed_indices", "improved_indices"],
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
def test_moving_average_cross_over_detector(
    min_data_points,
    short_moving_avg_factory,
    long_moving_avg_factory,
    values,
    regressed_indices,
    improved_indices,
):
    all_regressed = []
    all_improved = []

    now = datetime.now()

    payloads = [
        DetectorPayload(
            project_id=1,
            group=0,
            count=i + 1,
            value=value,
            timestamp=now + timedelta(hours=i + 1),
        )
        for i, value in enumerate(values)
    ]

    detector = MovingAverageCrossOverDetector(
        MovingAverageCrossOverDetectorState.empty(),
        MovingAverageCrossOverDetectorConfig(
            min_data_points=min_data_points,
            short_moving_avg_factory=short_moving_avg_factory,
            long_moving_avg_factory=long_moving_avg_factory,
        ),
    )

    for payload in payloads:
        trend_type = detector.update(payload)
        if trend_type == TrendType.Regressed:
            all_regressed.append(payload)
        elif trend_type == TrendType.Improved:
            all_improved.append(payload)

    assert all_regressed == [payloads[i] for i in regressed_indices]
    assert all_improved == [payloads[i] for i in improved_indices]


@pytest.mark.parametrize(
    ["min_data_points", "short_moving_avg_factory", "long_moving_avg_factory"],
    [
        pytest.param(
            6,
            lambda: ExponentialMovingAverage(2 / 21),
            lambda: ExponentialMovingAverage(2 / 41),
        ),
    ],
)
@django_db_all
def test_moving_average_cross_over_detector_bad_order(
    min_data_points,
    short_moving_avg_factory,
    long_moving_avg_factory,
):
    now = datetime.now()

    detector = MovingAverageCrossOverDetector(
        MovingAverageCrossOverDetectorState.empty(),
        MovingAverageCrossOverDetectorConfig(
            min_data_points=min_data_points,
            short_moving_avg_factory=short_moving_avg_factory,
            long_moving_avg_factory=long_moving_avg_factory,
        ),
    )

    payload = DetectorPayload(
        project_id=1,
        group=0,
        count=2,
        value=100,
        timestamp=now,
    )
    trend_type = detector.update(payload)
    assert trend_type is not None

    payload = DetectorPayload(
        project_id=1,
        group=0,
        count=1,
        value=100,
        timestamp=now - timedelta(hours=1),
    )
    trend_type = detector.update(payload)
    assert trend_type is None
