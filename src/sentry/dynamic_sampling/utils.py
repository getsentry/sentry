from enum import Enum
from typing import Dict, List, Optional, TypedDict

BOOSTED_RELEASES_LIMIT = 10
RELEASE_BOOST_FACTOR = 5
KEY_TRANSACTION_BOOST_FACTOR = 5
HEALTH_CHECK_DROPPING_FACTOR = 5


class Bias(TypedDict):
    id: str
    active: bool


# These represent the biases that are applied to user by default as part of the adaptive dynamic sampling
# experience. These can be overridden by the project details endpoint
class RuleType(Enum):
    UNIFORM_RULE = "uniformRule"
    BOOST_ENVIRONMENTS_RULE = "boostEnvironments"
    BOOST_LATEST_RELEASES_RULE = "boostLatestRelease"
    IGNORE_HEALTHCHECKS_RULE = "ignoreHealthChecks"
    BOOST_KEY_TRANSACTIONS_RULE = "boostKeyTransaction"


DEFAULT_BIASES: List[Bias] = [
    {"id": RuleType.BOOST_ENVIRONMENTS_RULE.value, "active": True},
    {
        "id": RuleType.BOOST_LATEST_RELEASES_RULE.value,
        "active": True,
    },
    {"id": RuleType.IGNORE_HEALTHCHECKS_RULE.value, "active": True},
    {"id": RuleType.BOOST_KEY_TRANSACTIONS_RULE.value, "active": True},
]
RESERVED_IDS = {
    RuleType.UNIFORM_RULE: 1000,
    RuleType.BOOST_ENVIRONMENTS_RULE: 1001,
    RuleType.IGNORE_HEALTHCHECKS_RULE: 1002,
    RuleType.BOOST_KEY_TRANSACTIONS_RULE: 1003,
    RuleType.BOOST_LATEST_RELEASES_RULE: 1500,
}


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


class TimeRange(TypedDict):
    start: str
    end: str


class ReleaseRule(BaseRule):
    timeRange: Optional[TimeRange]
