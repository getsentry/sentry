"""
Bias for custom rules (i.e. user-defined rules).
"""
import hashlib
from datetime import datetime
from typing import Any, Dict, List, Mapping, Optional, TypedDict

from sentry.dynamic_sampling import get_redis_client_for_ds
from sentry.dynamic_sampling.rules.utils import MAX_CUSTOM_RULES, RESERVED_IDS, RuleType
from sentry.snuba.metrics.extraction import RuleCondition
from sentry.utils import json

MAX_RULE_CLEANUP_TRIES = 4


class SerializedCustomRule(TypedDict, total=True):
    """
    The format of the rule data stored in Redis

    All rules for one org are stored in a Redis hash.
    NOTE: the key only contains the condition you can't have the same condition
    applied to different projects with different expiration dates.
    If a condition should be applied to many projects a single rule should be created

    """

    condition: RuleCondition  # the rule condition parsed from the query
    start: float  # the timestamp when the rule should become active (UNIX timestamp)
    expiration: float  # the timestamp of the rule's expiration (UNIX timestamp)
    project_ids: List[int]  # list of project ids applicable to this rule
    org_id: int  # the organization id
    count: int  # the number of samples to be collected
    rule_id: int  # the rule id


def get_custom_rule_hash(rule: SerializedCustomRule) -> str:
    """
    Returns the hash of the rule based on the condition and projects
    """
    condition = rule["condition"]
    projects = rule["project_ids"]
    condition_string = to_order_independent_string(condition)
    projects_string = to_order_independent_string(projects)
    string_val = f"{projects_string}-{condition_string}"
    # make it a bit shorter
    return hashlib.sha1(string_val.encode("utf-8")).hexdigest()


def get_rule_id(
    rule: SerializedCustomRule, org_rules: Dict[int, SerializedCustomRule]
) -> Optional[int]:
    """
    Returns True if a rule exists for the given condition and org
    """
    rule_hash = get_custom_rule_hash(rule)
    for rule_id, existing_rule in org_rules.items():
        if get_custom_rule_hash(existing_rule) == rule_hash:
            return rule_id
    return None


def rule_from_json(val: str) -> SerializedCustomRule:
    """
    Creates a SerializedRule from a json string
    """
    return json.loads(val)


def custom_rules_redis_key(org_id: int) -> str:
    """
    Returns the Redis key for the custom rules for an organization
    """
    return f"ds::o:{org_id}:custom-rules"


def to_order_independent_string(val: Any) -> str:
    """
    Converts a value in an order independent string and then hashes it

    Note: this will insure the same repr is generated for ['x', 'y'] and ['y', 'x']
        Also the same repr is generated for {'x': 1, 'y': 2} and {'y': 2, 'x': 1}
    """
    ret_val = ""
    if isinstance(val, Mapping):
        for key in sorted(val.keys()):
            ret_val += f"{key}:{to_order_independent_string(val[key])}-"
    elif isinstance(val, (list, tuple)):
        for item in sorted(val):
            ret_val += f"{to_order_independent_string(item)}-"
    else:
        ret_val = str(val)
    return ret_val


def remove_expired_rules(org_id: int):
    """
    Remove expired rules for an organization
    """
    key = custom_rules_redis_key(org_id)
    redis_client = get_redis_client_for_ds()

    for _ in range(MAX_RULE_CLEANUP_TRIES):
        if _remove_expired_rule_internal(redis_client, key):
            return  # successful removal no need to retry


def remove_satisfied_rules(org_id: int):
    """
    Remove rules that have all the samples collected
    """
    key = custom_rules_redis_key(org_id)
    redis_client = get_redis_client_for_ds()

    rules = redis_client.hgetall(key)
    for rule_key, rule_str in rules.items():
        collected = get_samples_collected_for_rule(rule_key, org_id)
        rule = rule_from_json(rule_str)
        if collected >= rule["count"]:
            redis_client.hdel(key, rule_key)


def get_samples_collected_for_rule(rule_key: str, org_id: int):
    """
    Gets the number of samples collected for a rule.

    Relay maintains a count of accepted samples for each rule

    """
    # TODO (RaduW) implement this when available in Relay
    # get Relay cluster
    # calculate rule key (org_id, rule_id)
    # get count from key
    return 0


def _remove_expired_rule_internal(redis_client, key) -> bool:
    """
    A re-runnable function that tries to remove expired rules for an organization
    using optimistic locking.

    If the key is modified while the function is running, the transaction is abandoned and the
    caller should retry this function until success or enough tries have passed and the operation
    can be considered failed.

    In practice, it is not expected that this function will fail more than once, if at all.
    """

    try:
        now = datetime.utcnow().timestamp()
        with redis_client.pipeline(transaction=True) as pipe:
            pipe.watch(key)
            rules = pipe.hgetall(key)
            pipe.multi()
            for rule_key, rule_str in rules.items():
                rule = rule_from_json(rule_str)
                if rule["expiration"] < now:
                    pipe.hdel(key, rule_key)
            pipe.execute()
    except redis_client.WatchError:
        return False
    return True


def get_custom_rule_id(org_id):
    """
    Returns the next rule id for an organization (and reserves the id)

    Note: Do not call it multiple times for a single rule (you'll waste ids).
    """
    key = f"ds::o:{org_id}:rule-id"
    redis_client = get_redis_client_for_ds()
    val = redis_client.incr(key)

    # try to reset the counter so it never overflows past 2^64 (don't worry if it doesn't
    # succeed it will continue to try at each increment until it succeeds)
    try:
        if val > MAX_CUSTOM_RULES:
            with redis_client.pipeline(transaction=True) as pipe:
                pipe.watch(key)
                x = pipe.get(key)
                pipe.multi()
                pipe.set(key, x % MAX_CUSTOM_RULES)
                pipe.execute()
    except redis_client.WatchError:
        pass  # better luck next time

    return val % MAX_CUSTOM_RULES + RESERVED_IDS[RuleType.CUSTOM_RULE]
