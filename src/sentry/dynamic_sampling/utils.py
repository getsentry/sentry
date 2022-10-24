from typing import Dict, List, Optional, TypedDict

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


class Inner(TypedDict):
    op: int
    name: str
    value: List[str]
    options: Dict[str, bool]


class Condition(TypedDict):
    op: str
    inner: List[Optional[Inner]]


class BaseRule(TypedDict):
    sampleRate: float
    type: str
    active: bool
    condition: Condition
    id: int


def generate_uniform_rule(sample_rate: Optional[float]) -> BaseRule:
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


def generate_environment_rule() -> BaseRule:
    return {
        "sampleRate": 1,
        "type": "trace",
        "condition": {
            "op": "or",
            "inner": [
                {
                    "op": "glob",
                    "name": "trace.environment",
                    "value": ["*dev*", "*test*"],
                    "options": {"ignoreCase": True},
                }
            ],
        },
        "active": True,
        "id": 1,
    }


def generate_rules(project: Project, enable_environment_bias=False):
    """
    This function handles generate rules logic or fallback empty list of rules
    """
    rules = []

    sample_rate = quotas.get_blended_sample_rate(project)

    if enable_environment_bias and sample_rate and sample_rate < 1.0:
        rules.append(generate_environment_rule())

    if sample_rate is None:
        try:
            raise Exception("get_blended_sample_rate returns none")
        except Exception:
            sentry_sdk.capture_exception()
    else:
        rules.append(generate_uniform_rule(project))
