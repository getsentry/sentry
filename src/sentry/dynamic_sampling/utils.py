from typing import Any, List, TypedDict

import sentry_sdk

from sentry import quotas
from sentry.models import Project

UNIFORM_RULE_RESERVED_ID = 0

# These represent the biases that are applied to user by default as part of the adaptive dynamic sampling experience.
# These can be overridden by the project details endpoint
DEFAULT_BIASES = [
    {"id": "boostEnvironments", "active": True},
    {
        "id": "boostLatestRelease",
        "active": True,
    },
    {"id": "ignoreHealthChecks", "active": True},
]


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
