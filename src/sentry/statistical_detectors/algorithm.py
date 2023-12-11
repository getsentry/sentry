from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Mapping, MutableMapping, Optional, Tuple

from sentry.statistical_detectors.detector import (
    DetectorAlgorithm,
    DetectorConfig,
    DetectorPayload,
    DetectorState,
    TrendType,
)
from sentry.utils import metrics
from sentry.utils.math import MovingAverage

logger = logging.getLogger("sentry.tasks.statistical_detectors.algorithm")


@dataclass(frozen=True)
class MovingAverageDetectorState(DetectorState):
    timestamp: Optional[datetime]
    count: int
    moving_avg_short: float
    moving_avg_long: float

    FIELD_TIMESTAMP = "T"
    FIELD_COUNT = "C"
    FIELD_MOVING_AVG_SHORT = "S"
    FIELD_MOVING_AVG_LONG = "L"

    def to_redis_dict(self) -> Mapping[str | bytes, bytes | float | int | str]:
        d: MutableMapping[str | bytes, bytes | float | int | str] = {
            self.FIELD_COUNT: self.count,
            self.FIELD_MOVING_AVG_SHORT: self.moving_avg_short,
            self.FIELD_MOVING_AVG_LONG: self.moving_avg_long,
        }

        if self.timestamp is not None:
            d[self.FIELD_TIMESTAMP] = int(self.timestamp.timestamp())

        return d

    @classmethod
    def from_redis_dict(cls, data: Any) -> MovingAverageDetectorState:
        ts = data.get(cls.FIELD_TIMESTAMP)
        timestamp = None if ts is None else datetime.fromtimestamp(int(ts), timezone.utc)
        count = int(data[cls.FIELD_COUNT])
        moving_avg_short = float(data[cls.FIELD_MOVING_AVG_SHORT])
        moving_avg_long = float(data[cls.FIELD_MOVING_AVG_LONG])
        return cls(
            timestamp=timestamp,
            count=count,
            moving_avg_short=moving_avg_short,
            moving_avg_long=moving_avg_long,
        )

    def should_auto_resolve(self, target: float, rel_threshold: float) -> bool:
        value = self.moving_avg_long

        rel_change = (target - value) / target
        if rel_change < rel_threshold:
            return True

        return False

    @classmethod
    def empty(cls) -> MovingAverageDetectorState:
        return cls(
            timestamp=None,
            count=0,
            moving_avg_short=0,
            moving_avg_long=0,
        )


@dataclass(frozen=True)
class MovingAverageDetectorConfig(DetectorConfig):
    min_data_points: int
    short_moving_avg_factory: Callable[[], MovingAverage]
    long_moving_avg_factory: Callable[[], MovingAverage]


class MovingAverageDetector(DetectorAlgorithm):
    def __init__(
        self,
        source: str,
        kind: str,
        state: MovingAverageDetectorState,
        config: MovingAverageDetectorConfig,
    ):
        self.source = source
        self.kind = kind

        self.moving_avg_short = config.short_moving_avg_factory()
        self.moving_avg_short.set(state.moving_avg_short, state.count)

        self.moving_avg_long = config.long_moving_avg_factory()
        self.moving_avg_long.set(state.moving_avg_long, state.count)

        self.timestamp = state.timestamp
        self.count = state.count
        self.config = config

    @property
    def state(self) -> MovingAverageDetectorState:
        return MovingAverageDetectorState(
            timestamp=self.timestamp,
            count=self.count,
            moving_avg_short=self.moving_avg_short.value,
            moving_avg_long=self.moving_avg_long.value,
        )


@dataclass(frozen=True)
class MovingAverageRelativeChangeDetectorConfig(MovingAverageDetectorConfig):
    threshold: float


class MovingAverageRelativeChangeDetector(MovingAverageDetector):
    config: MovingAverageRelativeChangeDetectorConfig

    def update(self, payload: DetectorPayload) -> Tuple[Optional[TrendType], float]:
        if self.timestamp is not None and self.timestamp > payload.timestamp:
            # In the event that the timestamp is before the payload's timestamps,
            # we do not want to process this payload.
            #
            # This should not happen other than in some error state.
            logger.warning(
                "Trend detection out of order. Processing %s, but last processed was %s",
                payload.timestamp.isoformat(),
                self.timestamp.isoformat(),
            )
            return None, 0

        old_moving_avg_short = self.moving_avg_short.value
        old_moving_avg_long = self.moving_avg_long.value

        self.moving_avg_short.update(payload.value)
        self.moving_avg_long.update(payload.value)
        self.timestamp = payload.timestamp
        self.count += 1

        # The heuristic isn't stable initially, so ensure we have a minimum
        # number of data points before looking for a regression.
        stablized = self.count > self.config.min_data_points

        score = abs(self.moving_avg_short.value - self.moving_avg_long.value)

        try:
            relative_change_old = (old_moving_avg_short - old_moving_avg_long) / abs(
                old_moving_avg_long
            )
            relative_change_new = (self.moving_avg_short.value - self.moving_avg_long.value) / abs(
                self.moving_avg_long.value
            )

            metrics.distribution(
                "statistical_detectors.rel_change",
                relative_change_new,
                tags={"source": self.source, "kind": self.kind},
            )
        except ZeroDivisionError:
            relative_change_old = 0
            relative_change_new = 0

        if (
            stablized
            and relative_change_old < self.config.threshold
            and relative_change_new > self.config.threshold
        ):
            return TrendType.Regressed, score

        elif (
            stablized
            and relative_change_old > -self.config.threshold
            and relative_change_new < -self.config.threshold
        ):
            return TrendType.Improved, score

        return TrendType.Unchanged, score
