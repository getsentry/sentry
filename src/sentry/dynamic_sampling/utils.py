from typing import Any, List, TypedDict

import sentry_sdk

from sentry import quotas
from sentry.models import Project

UNIFORM_RULE_RESERVED_ID = 0


class NoneSampleRateException(Exception):
    ...


class Condition(TypedDict):
    op: str
    inner: List[Any]


class UniformRule(TypedDict):
    sampleRate: float
    type: str
    active: bool
    condition: Condition
    id: int


def generate_uniform_rule(project: Project) -> UniformRule:
    sample_rate = quotas.get_blended_sample_rate(project)
    if sample_rate is None:
        try:
            raise Exception("get_blended_sample_rate returns none")
        except Exception:
            sentry_sdk.capture_exception()
        raise NoneSampleRateException
    return {
        "sampleRate": sample_rate,
        "type": "trace",
        "active": True,
        "condition": {
            "op": "and",
            "inner": [],
        },
        "id": UNIFORM_RULE_RESERVED_ID,
    }
