from typing import Dict, List, Optional, TypedDict

UNIFORM_RULE_RESERVED_ID = 0


class Bias(TypedDict):
    id: str
    active: bool


# These represent the biases that are applied to user by default as part of the adaptive dynamic sampling experience.
# These can be overridden by the project details endpoint
DEFAULT_BIASES: List[Bias] = [
    {"id": "boostEnvironments", "active": True},
    {
        "id": "boostLatestRelease",
        "active": True,
    },
    {"id": "ignoreHealthChecks", "active": True},
]


class Inner(TypedDict):
    op: str
    name: str
    value: List[str]
    options: Dict[str, bool]


class Condition(TypedDict):
    op: str
    inner: List[Optional[Inner]]


class BaseRule(TypedDict):
    sampleRate: Optional[float]
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
