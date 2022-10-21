<<<<<<< HEAD
from enum import Enum
from typing import Dict, List, Optional, TypedDict
||||||| parent of 1f195d7423 (fixup!)
from typing import Any, List, TypedDict
=======
from typing import Dict, List, Optional, TypedDict
>>>>>>> 1f195d7423 (fixup!)

BOOSTED_RELEASES_LIMIT = 10
RELEASE_BOOST_FACTOR = 5


class Bias(TypedDict):
    id: str
    active: bool


# These represent the biases that are applied to user by default as part of the adaptive dynamic sampling experience.
# These can be overridden by the project details endpoint
class RuleType(Enum):
    UNIFORM_RULE = "uniformRule"
    BOOST_ENVIRONMENTS_RULE = "boostEnvironments"
    BOOST_LATEST_RELEASES_RULE = "boostLatestRelease"
    IGNORE_HEALTHCHECKS_RULE = "ignoreHealthChecks"


DEFAULT_BIASES: List[Bias] = [
    {"id": RuleType.BOOST_ENVIRONMENTS_RULE.value, "active": True},
    {
        "id": RuleType.BOOST_LATEST_RELEASES_RULE.value,
        "active": True,
    },
    {"id": RuleType.IGNORE_HEALTHCHECKS_RULE.value, "active": True},
]
RESERVED_IDS = {
    RuleType.UNIFORM_RULE: 1000,
    RuleType.BOOST_ENVIRONMENTS_RULE: 1001,
    RuleType.IGNORE_HEALTHCHECKS_RULE: 1002,
    RuleType.BOOST_LATEST_RELEASES_RULE: 1500,
}


<<<<<<< HEAD
class Inner(TypedDict):
    op: str
    name: str
    value: List[str]
    options: Dict[str, bool]


||||||| parent of 6c49312dd6 (fixup!)
class NoneSampleRateException(Exception):
    ...


=======
>>>>>>> 6c49312dd6 (fixup!)
class Inner(TypedDict):
    op: int
    name: str
    value: List[str]
    options: Dict[str, bool]


class Condition(TypedDict):
    op: str
    inner: List[Optional[Inner]]


<<<<<<< HEAD
class BaseRule(TypedDict):
    sampleRate: Optional[float]
||||||| parent of 1f195d7423 (fixup!)
class UniformRule(TypedDict):
    sampleRate: float
=======
class BaseRule(TypedDict):
    sampleRate: float
>>>>>>> 1f195d7423 (fixup!)
    type: str
    active: bool
    condition: Condition
    id: int


<<<<<<< HEAD
class TimeRange(TypedDict):
    start: str
    end: str


class ReleaseRule(BaseRule):
    timeRange: Optional[TimeRange]
||||||| parent of 1f195d7423 (fixup!)
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
=======
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
<<<<<<< HEAD
        rules.append(generate_uniform_rule(project))
>>>>>>> 1f195d7423 (fixup!)
||||||| parent of 6c49312dd6 (fixup!)
        rules.append(generate_uniform_rule(project))
=======
        rules.append(generate_uniform_rule(sample_rate))

    return rules
>>>>>>> 6c49312dd6 (fixup!)
