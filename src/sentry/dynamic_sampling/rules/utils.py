from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Set, Tuple, TypedDict, Union

from sentry.utils import json

BOOSTED_RELEASES_LIMIT = 10
BOOSTED_KEY_TRANSACTION_LIMIT = 10

RELEASE_BOOST_FACTOR = 5
KEY_TRANSACTION_BOOST_FACTOR = 5
HEALTH_CHECK_DROPPING_FACTOR = 5


class ActivatableBias(TypedDict):
    """
    A bias that can be activated, where activated means that the bias is enabled.
    """

    id: str
    active: bool


# These represent the biases that are applied to user by default as part of the adaptive dynamic sampling
# experience. These can be overridden by the project details endpoint
class RuleType(Enum):
    UNIFORM_RULE = "uniformRule"
    BOOST_ENVIRONMENTS_RULE = "boostEnvironments"
    BOOST_LATEST_RELEASES_RULE = "boostLatestRelease"
    IGNORE_HEALTH_CHECKS_RULE = "ignoreHealthChecks"
    BOOST_KEY_TRANSACTIONS_RULE = "boostKeyTransactions"


DEFAULT_BIASES: List[ActivatableBias] = [
    {"id": RuleType.BOOST_ENVIRONMENTS_RULE.value, "active": True},
    {
        "id": RuleType.BOOST_LATEST_RELEASES_RULE.value,
        "active": True,
    },
    {"id": RuleType.IGNORE_HEALTH_CHECKS_RULE.value, "active": True},
    {"id": RuleType.BOOST_KEY_TRANSACTIONS_RULE.value, "active": True},
]
RESERVED_IDS = {
    RuleType.UNIFORM_RULE: 1000,
    RuleType.BOOST_ENVIRONMENTS_RULE: 1001,
    RuleType.IGNORE_HEALTH_CHECKS_RULE: 1002,
    RuleType.BOOST_KEY_TRANSACTIONS_RULE: 1003,
    RuleType.BOOST_LATEST_RELEASES_RULE: 1500,
}
REVERSE_RESERVED_IDS = {value: key for key, value in RESERVED_IDS.items()}


SamplingValueType = Literal["sampleRate", "factor"]


class SamplingValue(TypedDict):
    type: SamplingValueType
    value: float


class TimeRange(TypedDict):
    start: str
    end: str


class Inner(TypedDict):
    op: str
    name: str
    value: List[str]
    options: Dict[str, bool]


class Condition(TypedDict):
    op: str
    inner: List[Inner]


class BaseRule(TypedDict):
    type: str
    active: bool
    condition: Condition
    id: int


class RuleV1(BaseRule):
    sampleRate: float


class RuleV2(BaseRule):
    samplingValue: SamplingValue


class DecayingFnV1(TypedDict):
    type: str
    decayedSampleRate: Optional[str]


class DecayingRuleV1(RuleV1):
    timeRange: TimeRange
    decayingFn: DecayingFnV1


class DecayingFnV2(TypedDict):
    type: str
    decayedValue: Optional[str]


class DecayingRuleV2(RuleV2):
    timeRange: TimeRange
    decayingFn: DecayingFnV2


# Type defining the all the possible rules types that can exist.
PolymorphicRule = Union[RuleV1, RuleV2, DecayingRuleV1, DecayingRuleV2]


def get_rule_type(rule: BaseRule) -> Optional[RuleType]:
    # Edge case handled naively in which we check if the ID is within the possible bounds. This is done because the
    # latest release rules have ids from 1500 to 1500 + (limit - 1). For example if the limit is 2, we will only have
    # ids: 1500, 1501.
    #
    # This implementation MUST be changed in case we change the logic of rule ids.
    if (
        RESERVED_IDS[RuleType.BOOST_LATEST_RELEASES_RULE]
        <= rule["id"]
        < RESERVED_IDS[RuleType.BOOST_LATEST_RELEASES_RULE] + BOOSTED_RELEASES_LIMIT
    ):
        return RuleType.BOOST_LATEST_RELEASES_RULE

    return REVERSE_RESERVED_IDS.get(rule["id"], None)


def get_rule_hash(rule: PolymorphicRule) -> int:
    # We want to be explicit in what we use for computing the hash. In addition, we need to remove certain fields like
    # the sampleRate.
    return json.dumps(
        _deep_sorted(
            {
                "id": rule["id"],
                "type": rule["type"],
                "active": rule["active"],
                "condition": rule["condition"],
            }
        )
    ).__hash__()


def get_sampling_value(rule: PolymorphicRule) -> Optional[Tuple[str, float]]:
    # Gets the sampling value from the rule, based on the type.
    if "samplingValue" in rule:
        sampling_value = rule["samplingValue"]  # type:ignore
        return sampling_value["type"], float(sampling_value["value"])
    # This should be removed once V1 is faded out.
    elif "sampleRate" in rule:
        return "sampleRate", rule["sampleRate"]  # type:ignore

    return None


def _deep_sorted(value: Union[Any, Dict[Any, Any]]) -> Union[Any, Dict[Any, Any]]:
    if isinstance(value, dict):
        return {key: _deep_sorted(value) for key, value in sorted(value.items())}
    else:
        return value


def get_user_biases(user_set_biases: Optional[List[ActivatableBias]]) -> List[ActivatableBias]:
    if user_set_biases is None:
        return DEFAULT_BIASES

    id_to_user_bias = {bias["id"]: bias for bias in user_set_biases}
    returned_biases = []
    for bias in DEFAULT_BIASES:
        if bias["id"] in id_to_user_bias:
            returned_biases.append(id_to_user_bias[bias["id"]])
        else:
            returned_biases.append(bias)

    return returned_biases


def get_enabled_user_biases(user_set_biases: Optional[List[ActivatableBias]]) -> Set[str]:
    users_biases = get_user_biases(user_set_biases)
    return {bias["id"] for bias in users_biases if bias["active"]}


def get_supported_biases_ids() -> Set[str]:
    return {bias["id"] for bias in DEFAULT_BIASES}
