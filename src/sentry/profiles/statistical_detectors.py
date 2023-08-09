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
        try:
            count = int(d.get(RegressionState.FIELD_COUNT, 0))
        except ValueError:
            count = 0

        try:
            short_ma = float(d.get(RegressionState.FIELD_SHORT_TERM, 0))
        except ValueError:
            short_ma = 0

        try:
            long_ma = float(d.get(RegressionState.FIELD_LONG_TERM, 0))
        except ValueError:
            long_ma = 0

        try:
            timestamp = datetime.fromisoformat(d.get(RegressionState.FIELD_TIMESTAMP, ""))
        except ValueError:
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
    cluster_key = "default"  # TODO: read from settings
    client = redis.redis_clusters.get(cluster_key)

    with client.pipeline() as pipeline:
        for payload in payloads:
            key = make_function_key(project.id, payload, VERSION)
            pipeline.hgetall(key)
        results = pipeline.execute()

    old_states = [RegressionState.from_dict(result) for result in results]
    new_states, regressed_functions = compute_new_regression_states(
        project.id, old_states, payloads
    )

    with client.pipeline() as pipeline:
        for key, value in new_states:
            pipeline.hmset(key, value.as_dict())
            pipeline.expire(key, KEY_TTL)

        pipeline.execute()

    return regressed_functions


def compute_new_regression_states(
    project_id: int,
    old_states: List[RegressionState],
    payloads: List[FunctionPayload],
) -> Tuple[List[Tuple[str, RegressionState]], List[FunctionPayload]]:
    new_states: List[Tuple[str, RegressionState]] = []
    regressed_functions: List[FunctionPayload] = []

    for payload, old_state in zip(payloads, old_states):
        if old_state.timestamp is not None and old_state.timestamp < payload.timestamp:
            # In the event that the timestamp is before the payload's timestamps,
            # we do not want to process this payload.
            #
            # This should not happen other than in some error state.
            logger.warn(
                "Function regression detection out of order. Processing %s, but last processed was %s",
                payload.timestamp.isoformat(),
                old_state.timestamp.isoformat(),
            )
            continue

        key = make_function_key(project_id, payload, VERSION)
        regressed, value = detect_regression(old_state, payload)

        if regressed:
            regressed_functions.append(payload)

        new_states.append((key, value))

    return new_states, regressed_functions


def make_function_key(project_id: int, payload: FunctionPayload, version: int) -> str:
    return f"statdtr:v:{version}:p:{project_id}:f:{payload.fingerprint}"


def detect_regression(
    state: RegressionState, payload: FunctionPayload
) -> Tuple[bool, RegressionState,]:  # Mapping[str | bytes, str | float | int]
    """
    Detect if a regression has occurred using the moving average cross over.
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
