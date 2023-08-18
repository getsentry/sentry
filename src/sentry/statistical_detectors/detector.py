from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Mapping, MutableMapping, Optional, Tuple

from sentry.utils.math import ExponentialMovingAverage

logger = logging.getLogger("sentry.tasks.statistical_detectors")

KEY_TTL = 24 * 60 * 60  # 1 day TTL
MIN_DATA_POINTS = 6
VERSION = 1


class TrendType(Enum):
    Regressed = "regressed"
    Improved = "improved"
    Unchanged = "unchanged"


@dataclass
class TrendState:
    timestamp: Optional[datetime]
    count: int
    short_ma: float
    long_ma: float

    FIELD_TIMESTAMP = "T"
    FIELD_COUNT = "N"
    FIELD_SHORT_TERM = "S"
    FIELD_LONG_TERM = "L"

    def as_dict(self) -> Mapping[str | bytes, str | float | int]:
        d: MutableMapping[str | bytes, str | float | int] = {
            TrendState.FIELD_COUNT: self.count,
            TrendState.FIELD_SHORT_TERM: self.short_ma,
            TrendState.FIELD_LONG_TERM: self.long_ma,
        }
        if self.timestamp is not None:
            d[TrendState.FIELD_TIMESTAMP] = self.timestamp.isoformat()
        return d

    @staticmethod
    def from_dict(d: Any) -> TrendState:
        try:
            count = int(d.get(TrendState.FIELD_COUNT, 0))
        except ValueError:
            count = 0

        try:
            short_ma = float(d.get(TrendState.FIELD_SHORT_TERM, 0))
        except ValueError:
            short_ma = 0

        try:
            long_ma = float(d.get(TrendState.FIELD_LONG_TERM, 0))
        except ValueError:
            long_ma = 0

        try:
            timestamp = datetime.fromisoformat(d.get(TrendState.FIELD_TIMESTAMP, ""))
        except ValueError:
            timestamp = None

        return TrendState(timestamp, count, short_ma, long_ma)


@dataclass
class TrendPayload:
    group: str | int
    count: float
    value: float
    timestamp: datetime


def compute_new_trend_states(
    cur_state: TrendState,
    payload: TrendPayload,
) -> Optional[Tuple[TrendState, Tuple[TrendType, TrendPayload]]]:
    if cur_state.timestamp is not None and cur_state.timestamp > payload.timestamp:
        # In the event that the timestamp is before the payload's timestamps,
        # we do not want to process this payload.
        #
        # This should not happen other than in some error state.
        logger.warning(
            "Trend detection out of order. Processing %s, but last processed was %s",
            payload.timestamp.isoformat(),
            cur_state.timestamp.isoformat(),
        )
        return None

    trend, new_state = detect_trend(cur_state, payload)

    return new_state, (trend, payload)


def detect_trend(state: TrendState, payload: TrendPayload) -> Tuple[TrendType, TrendState]:
    """
    Detect if a change has occurred using the moving average cross over.
    See https://en.wikipedia.org/wiki/Moving_average_crossover.

    We keep track of 2 moving averages, one with a shorter period and one with
    a longer period. The shorter period moving average is a faster moving average
    that is more sensitive to immediate changes in the timeseries. The longer
    period moving average is a slower moving average that smooths out more of the
    noise that may be present in the fast moving average.

    By tracking both of these moving averages, we're looking for when the fast
    moving average cross the slow moving average from below. Whenever this happens,
    it is an indication that the timeseries is trending upwards.

    Here, we choose to use the exponential moving average as it is less sensitive
    to large variations in the data and allows us weigh the newly seen data more
    heavily than old data that is no longer relevant.
    """

    # This EMA uses a shorter period to follow the timeseries more closely.
    ema_short = ExponentialMovingAverage(smoothing=2, period=20)
    ema_short.set(state.short_ma, state.count)
    ema_short.update(payload.value)

    # This EMA uses a longer period to follow the overal trend of the timeseries.
    ema_long = ExponentialMovingAverage(smoothing=2, period=40)
    ema_long.set(state.long_ma, state.count)
    ema_long.update(payload.value)

    # The heuristic isn't stable initially, so ensure we have a minimum
    # number of data points before looking for a regression.
    stablized = state.count > MIN_DATA_POINTS

    if stablized and ema_short.value > ema_long.value and state.short_ma <= state.long_ma:
        # The new fast moving average is above the new slow moving average.
        # The old fast moving average is below the old slow moving average.
        # This indicates an upwards trend.
        trend = TrendType.Regressed
    elif stablized and ema_short.value < ema_long.value and state.short_ma >= state.long_ma:
        # The new fast moving average is below the new slow moving average
        # The old fast moving average is above the old slow moving average
        # This indicates an downwards trend.
        trend = TrendType.Improved
    else:
        trend = TrendType.Unchanged

    new_state = TrendState(payload.timestamp, state.count + 1, ema_short.value, ema_long.value)

    return trend, new_state
