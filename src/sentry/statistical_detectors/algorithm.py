from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from collections.abc import Callable, Mapping, MutableMapping
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import sentry_sdk

from sentry.statistical_detectors.base import DetectorPayload, DetectorState, TrendType
from sentry.utils import metrics
from sentry.utils.math import MovingAverage

logger = logging.getLogger("sentry.tasks.statistical_detectors.algorithm")


@dataclass(frozen=True)
class MovingAverageDetectorState(DetectorState):
    timestamp: datetime | None
    count: int
    moving_avg_short: float
    moving_avg_long: float

    FIELD_TIMESTAMP = "T"
    FIELD_COUNT = "C"
    FIELD_MOVING_AVG_SHORT = "S"
    FIELD_MOVING_AVG_LONG = "L"

    def get_moving_avg(self) -> float:
        return self.moving_avg_long

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
        value = self.get_moving_avg()

        rel_change = (value - target) / target
        if rel_change < rel_threshold:
            return True

        return False

    def should_escalate(
        self, baseline: float, regressed: float, min_change: float, rel_threshold: float
    ) -> bool:
        value = self.get_moving_avg()

        change = value - regressed
        if change < min_change:
            return False

        rel_change = change / (regressed - baseline)
        if rel_change > rel_threshold:
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


class DetectorAlgorithm(ABC):
    @abstractmethod
    def update(
        self,
        raw: Mapping[str | bytes, bytes | float | int | str],
        payload: DetectorPayload,
    ) -> tuple[TrendType, float, DetectorState | None]: ...


class MovingAverageRelativeChangeDetector(DetectorAlgorithm):
    def __init__(
        self,
        source: str,
        kind: str,
        min_data_points: int,
        moving_avg_short_factory: Callable[[], MovingAverage],
        moving_avg_long_factory: Callable[[], MovingAverage],
        threshold: float,
    ):
        self.source = source
        self.kind = kind
        self.min_data_points = min_data_points
        self.moving_avg_short_factory = moving_avg_short_factory
        self.moving_avg_long_factory = moving_avg_long_factory
        self.threshold = threshold

    def update(
        self,
        raw_state: Mapping[str | bytes, bytes | float | int | str],
        payload: DetectorPayload,
    ) -> tuple[TrendType, float, DetectorState | None]:
        try:
            old = MovingAverageDetectorState.from_redis_dict(raw_state)
        except Exception as e:
            old = MovingAverageDetectorState.empty()

            if raw_state:
                # empty raw state implies that there was no
                # previous state so no need to capture an exception
                sentry_sdk.capture_exception(e)

        if old.timestamp is not None and old.timestamp > payload.timestamp:
            # In the event that the timestamp is before the payload's timestamps,
            # we do not want to process this payload.
            #
            # This should not happen other than in some error state.
            logger.warning(
                "Trend detection out of order. Processing %s, but last processed was %s",
                payload.timestamp.isoformat(),
                old.timestamp.isoformat(),
            )
            return TrendType.Skipped, 0, None

        moving_avg_short = self.moving_avg_short_factory()
        moving_avg_long = self.moving_avg_long_factory()

        new = MovingAverageDetectorState(
            timestamp=payload.timestamp,
            count=old.count + 1,
            moving_avg_short=moving_avg_short.update(
                old.count, old.moving_avg_short, payload.value
            ),
            moving_avg_long=moving_avg_long.update(old.count, old.moving_avg_long, payload.value),
        )

        # The heuristic isn't stable initially, so ensure we have a minimum
        # number of data points before looking for a regression.
        stablized = new.count > self.min_data_points

        score = abs(new.moving_avg_short - new.moving_avg_long)

        try:
            relative_change_old = (old.moving_avg_short - old.moving_avg_long) / abs(
                old.moving_avg_long
            )
            relative_change_new = (new.moving_avg_short - new.moving_avg_long) / abs(
                new.moving_avg_long
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
            and relative_change_old < self.threshold
            and relative_change_new > self.threshold
        ):
            return TrendType.Regressed, score, new

        elif (
            stablized
            and relative_change_old > -self.threshold
            and relative_change_new < -self.threshold
        ):
            return TrendType.Improved, score, new

        return TrendType.Unchanged, score, new
