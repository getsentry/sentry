from typing import Any, List, TypedDict

from sentry import quotas
from sentry.models import Project

UNIFORM_RULE_RESERVED_ID = 0


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
    return {
        "sampleRate": quotas.get_blended_sample_rate(project),
        "type": "trace",
        "active": True,
        "condition": {
            "op": "and",
            "inner": [],
        },
        "id": UNIFORM_RULE_RESERVED_ID,
    }
