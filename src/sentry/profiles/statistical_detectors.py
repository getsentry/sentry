from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, List, Mapping, MutableMapping, Optional, Tuple

from sentry.models.project import Project
from sentry.utils import redis
from sentry.utils.math import ExponentialMovingAverage

logger = logging.getLogger("sentry.tasks.statistical_detectors")

KEY_TTL = 24 * 60 * 60  # 1 day TTL
MIN_DATA_POINTS = 6
VERSION = 1


@dataclass
class RegressionState:
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
            RegressionState.FIELD_COUNT: self.count,
            RegressionState.FIELD_SHORT_TERM: self.short_ma,
            RegressionState.FIELD_LONG_TERM: self.long_ma,
        }
        if self.timestamp is not None:
            d[RegressionState.FIELD_TIMESTAMP] = self.timestamp.isoformat()
        return d

    @staticmethod
    def from_dict(d: Any) -> RegressionState:
        count = int(d.get(RegressionState.FIELD_COUNT, 0))
        short_ma = float(d.get(RegressionState.FIELD_SHORT_TERM, 0))
        long_ma = float(d.get(RegressionState.FIELD_LONG_TERM, 0))

        try:
            timestamp = datetime.fromisoformat(d.get(RegressionState.FIELD_TIMESTAMP))
        except (ValueError, TypeError):
            timestamp = None

        return RegressionState(timestamp, count, short_ma, long_ma)


@dataclass
class FunctionPayload:
    fingerprint: int
    count: float
    p95: float
    timestamp: datetime


def run_regressed_functions_detection(
    project: Project, start: datetime, payloads: List[FunctionPayload]
) -> List[FunctionPayload]:
    regressed_functions: List[FunctionPayload] = []

    cluster_key = "default"  # TODO: read from settings
    client = redis.redis_clusters.get(cluster_key)

    with client.pipeline() as pipeline:
        for payload in payloads:
            key = make_function_key(project, payload, VERSION)
            pipeline.hgetall(key)
        results = pipeline.execute()

    old_states = [RegressionState.from_dict(result) for result in results]

    new_states = []

    for payload, old_state in zip(payloads, old_states):
        if is_out_of_order(old_state, payload):
            continue

        key = make_function_key(project, payload, VERSION)
        regressed, value = detect_regression(old_state, payload)

        if regressed:
            regressed_functions.append(payload)

        new_states.append((key, value))

    with client.pipeline() as pipeline:
        for key, value in new_states:
            pipeline.hmset(key, value.as_dict())
            pipeline.expire(key, KEY_TTL)

        pipeline.execute()

    return regressed_functions


def make_function_key(project: Project, payload: FunctionPayload, version: int) -> str:
    return f"statdtr:v:{version}:p:{project.id}:f:{payload.fingerprint}"


def is_out_of_order(state: RegressionState, payload: FunctionPayload) -> bool:
    # The previous value does not have a timestamp associated with it.
    # This can happen the first time the key is added.
    if state.timestamp is None:
        return True

    if state.timestamp < payload.timestamp:
        return True

    # In the event that the timestamp is before the payload's timestamps,
    # we do not want to process this payload.
    # This should not happen other than in some error state.
    logger.warn(
        "Function regression detection out of order. Processing %s, but last processed was %s",
        payload.timestamp.isoformat(),
        state.timestamp.isoformat(),
    )
    return False


def detect_regression(
    state: RegressionState, payload: FunctionPayload
) -> Tuple[bool, RegressionState,]:  # Mapping[str | bytes, str | float | int]
    """
    Detect if a regression has occurred using the moving average cross over.
    See https://en.wikipedia.org/wiki/Moving_average_crossover

    We keep track of 2 moving averages, one with a shorter period and one with
    a longer period. The shorter period moving average is a faster moving average
    that is more sensitive to immediate changes in the timeseries. The longer
    period moving average is a slower moving average that smooths out more of the
    noise that may be present in the fast moving average.

    By tracking both of these moving averages, we're looking for when the fast
    moving average cross the slow moving average from below. Whenever this happens,
    it is an indication that the timeseries is trending upwards.
    """

    # This EMA uses a shorter period to follow the timeseries more closely.
    ema_short = ExponentialMovingAverage(smoothing=2, period=20)
    ema_short.set(state.short_ma, state.count)
    ema_short.update(payload.p95)

    # This EMA uses a longer period to follow the overal trend of the timeseries.
    ema_long = ExponentialMovingAverage(smoothing=2, period=40)
    ema_long.set(state.long_ma, state.count)
    ema_long.update(payload.p95)

    # wait for the timeseries to stabilize then look for when the fast moving
    # average cross the slow moving average from below
    regressed = (
        # The heuristic isn't stable initially, so ensure we have a minimum
        # number of data points before looking for a regression.
        state.count > MIN_DATA_POINTS
        # The new fast moving average is above the new slow moving average
        and ema_short.value > ema_long.value
        # The old fast moving average is below the old slow moving average
        and state.short_ma < state.long_ma
    )

    new_state = RegressionState(payload.timestamp, state.count + 1, ema_short.value, ema_long.value)

    return regressed, new_state
