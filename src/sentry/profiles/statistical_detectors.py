from dataclasses import dataclass
from datetime import datetime
from typing import List, Mapping, Union

from sentry.models.project import Project
from sentry.utils import redis
from sentry.utils.math import ExponentialMovingAverage

# TODO: figure out mypy complains why the key is just `str`
DetectorState = Mapping[Union[str, bytes], Union[float, int]]


KEY_TTL = 24 * 60 * 60  # 1 day TTL
MIN_DATA_POINTS = 6
FIELD_COUNT = "N"
FIELD_SHORT_TERM = "S"
FIELD_LONG_TERM = "L"


@dataclass
class FunctionPayload:
    fingerprint: int
    count: float
    p95: float
    timestamp: datetime


def run_regressed_functions_detection(
    project: Project, start: datetime, payloads: List[FunctionPayload]
) -> None:
    cluster_key = "default"  # TODO: move this to a setting
    client = redis.redis_clusters.get(cluster_key)

    with client.pipeline() as pipeline:
        for payload in payloads:
            key = _make_function_key(project, payload)
            pipeline.hgetall(key)

        results = pipeline.execute()

    new_states = []

    for payload, result in zip(payloads, results):
        key = _make_function_key(project, payload)

        n = int(result.get(FIELD_COUNT, 0))

        ema_short_old = float(result.get(FIELD_SHORT_TERM, 0))
        ema_short = ExponentialMovingAverage(smoothing=2, period=20)
        ema_short.set(ema_short_old, n)
        ema_short.update(payload.p95)

        ema_long_old = float(result.get(FIELD_LONG_TERM, 0))
        ema_long = ExponentialMovingAverage(smoothing=2, period=40)
        ema_long.set(ema_long_old, n)
        ema_long.update(payload.p95)

        value: DetectorState = {
            FIELD_COUNT: n + 1,
            FIELD_SHORT_TERM: ema_short.value,
            FIELD_LONG_TERM: ema_long.value,
        }
        new_states.append((key, value))

        if (
            # The heuristic isn't stable initially, so ensure we have a minimum
            # number of data points before looking for a regression.
            n > MIN_DATA_POINTS
            and is_regressed(ema_short_old, ema_short.value, ema_long_old, ema_long.value)
        ):
            pass

    with client.pipeline() as pipeline:
        for key, value in new_states:
            pipeline.hmset(key, value)
            pipeline.expire(key, KEY_TTL)

        pipeline.execute()


def _make_function_key(project: Project, payload: FunctionPayload) -> str:
    return f"statdtr:p:{project.id}:f:{payload.fingerprint}"


def is_regressed(
    avg_short_old: float,
    avg_short_new: float,
    avg_long_old: float,
    avg_long_new: float,
) -> bool:
    # We're looking for the point where the short term average crosses above the
    # long term average. This is an indication that the timeseries has a upwards
    # moving trend.
    # This is because the short term average reacts faster to changes in the
    # data compared to the long term average. So by looking for the cross over
    # we can determine the start of the regression.
    return avg_short_new > avg_long_new and avg_short_old <= avg_long_old
