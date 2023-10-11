from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Set, Tuple, TypedDict, Union

from django.conf import settings
from typing_extensions import NotRequired

from sentry.models.dynamicsampling import CUSTOM_RULE_START
from sentry.utils import json, redis

BOOSTED_RELEASES_LIMIT = 10

LATEST_RELEASES_BOOST_FACTOR = 1.5
LATEST_RELEASES_BOOST_DECAYED_FACTOR = 1.0

IGNORE_HEALTH_CHECKS_FACTOR = 5

ProjectId = int
DecisionDropCount = int
DecisionKeepCount = int
OrganizationId = int
TransactionName = str


class ActivatableBias(TypedDict):
    """
    A bias that can be activated, where activated means that the bias is enabled.
    """

    id: str
    active: bool


# These represent the biases that are applied to user by default as part of the adaptive dynamic sampling
# experience. These can be overridden by the project details endpoint
class RuleType(Enum):
    # Legacy value "uniformRule" is kept for backwards compatibility, since it is used as a key in the project options
    BOOST_LOW_VOLUME_PROJECTS_RULE = "uniformRule"
    RECALIBRATION_RULE = "recalibrationRule"
    BOOST_ENVIRONMENTS_RULE = "boostEnvironments"
    BOOST_LATEST_RELEASES_RULE = "boostLatestRelease"
    IGNORE_HEALTH_CHECKS_RULE = "ignoreHealthChecks"
    BOOST_KEY_TRANSACTIONS_RULE = "boostKeyTransactions"
    BOOST_LOW_VOLUME_TRANSACTIONS_RULE = "boostLowVolumeTransactions"
    BOOST_REPLAY_ID_RULE = "boostReplayId"
    CUSTOM_RULE = "customRule"


DEFAULT_BIASES: List[ActivatableBias] = [
    {"id": RuleType.BOOST_ENVIRONMENTS_RULE.value, "active": True},
    {
        "id": RuleType.BOOST_LATEST_RELEASES_RULE.value,
        "active": True,
    },
    {"id": RuleType.IGNORE_HEALTH_CHECKS_RULE.value, "active": True},
    {"id": RuleType.BOOST_KEY_TRANSACTIONS_RULE.value, "active": True},
    {"id": RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE.value, "active": True},
    {"id": RuleType.BOOST_REPLAY_ID_RULE.value, "active": True},
    {"id": RuleType.RECALIBRATION_RULE.value, "active": True},
]
RESERVED_IDS = {
    RuleType.BOOST_LOW_VOLUME_PROJECTS_RULE: 1000,
    RuleType.BOOST_ENVIRONMENTS_RULE: 1001,
    RuleType.IGNORE_HEALTH_CHECKS_RULE: 1002,
    RuleType.BOOST_KEY_TRANSACTIONS_RULE: 1003,
    RuleType.RECALIBRATION_RULE: 1004,
    RuleType.BOOST_REPLAY_ID_RULE: 1005,
    RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE: 1400,
    RuleType.BOOST_LATEST_RELEASES_RULE: 1500,
    RuleType.CUSTOM_RULE: CUSTOM_RULE_START,
}
REVERSE_RESERVED_IDS = {value: key for key, value in RESERVED_IDS.items()}


SamplingValueType = Literal["sampleRate", "factor", "reservoir"]


# (RaduW) Maybe we can split in two types, one for reservoir and one for sampleRate and factor
# Wanted to do this but couldn't think of three good names for the types (SamplingValue, ReservoirSamplingValue and ?
# some type name for the old SamplingValue type)
class SamplingValue(TypedDict):
    type: SamplingValueType
    value: NotRequired[float]
    limit: NotRequired[int]


class TimeRange(TypedDict):
    start: str
    end: str


class EqConditionOptions(TypedDict):
    ignoreCase: bool


class EqCondition(TypedDict):
    op: Literal["eq"]
    name: str
    value: Union[List[str], None]
    options: EqConditionOptions


class GlobCondition(TypedDict):
    op: Literal["glob"]
    name: str
    value: List[str]


class Condition(TypedDict):
    op: Literal["and", "or", "not"]
    inner: Union[Union[EqCondition, GlobCondition], List[Union[EqCondition, GlobCondition]]]


class Rule(TypedDict):
    samplingValue: SamplingValue
    type: str
    condition: Union[Condition, GlobCondition, EqCondition]
    id: int


class DecayingFn(TypedDict):
    type: str
    decayedValue: NotRequired[Optional[str]]


class DecayingRule(Rule):
    timeRange: TimeRange
    decayingFn: NotRequired[DecayingFn]  # const decaying doesn't require a decayingFn


# Type defining the all the possible rules types that can exist.
PolymorphicRule = Union[Rule, DecayingRule]


def get_rule_type(rule: Rule) -> Optional[RuleType]:
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
    elif (
        RESERVED_IDS[RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE]
        <= rule["id"]
        < RESERVED_IDS[RuleType.BOOST_LATEST_RELEASES_RULE]
    ):
        return RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE

    return REVERSE_RESERVED_IDS.get(rule["id"], None)


def get_rule_hash(rule: PolymorphicRule) -> int:
    # We want to be explicit in what we use for computing the hash. In addition, we need to remove certain fields like
    # the sampleRate.
    return json.dumps(
        _deep_sorted(
            {
                "id": rule["id"],
                "type": rule["type"],
                "condition": rule["condition"],
            }
        )
    ).__hash__()


def get_sampling_value(rule: PolymorphicRule) -> Optional[Tuple[str, float]]:
    sampling = rule["samplingValue"]
    if sampling["type"] == "reservoir":
        return sampling["type"], float(sampling["limit"])
    elif sampling["type"] in ("sampleRate", "factor"):
        return sampling["type"], float(sampling["value"])
    else:
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


def get_supported_biases_ids() -> List[str]:
    return sorted({bias["id"] for bias in DEFAULT_BIASES})


def apply_dynamic_factor(base_sample_rate: float, x: float) -> float:
    """
    This function known as dynamic factor function is used during the rules generation in order to determine the factor
    for each rule based on the base_sample_rate of the project.

    The high-level idea is that we want to reduce the factor the bigger the base_sample_rate becomes, this is done
    because multiplication will exceed 1 very quickly in case we don't reduce the factor.
    """
    if x == 0:
        raise Exception("A dynamic factor of 0 cannot be set.")

    if base_sample_rate < 0.0 or base_sample_rate > 1.0:
        raise Exception(
            "The dynamic factor function requires a sample rate in the interval [0.0, 1.0]."
        )

    return float(x / x**base_sample_rate)


def get_redis_client_for_ds() -> Any:
    cluster_key = settings.SENTRY_DYNAMIC_SAMPLING_RULES_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)
