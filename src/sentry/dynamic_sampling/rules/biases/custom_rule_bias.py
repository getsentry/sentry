"""
Bias for custom rules (i.e. user-defined rules).
"""
import hashlib
from datetime import datetime
from typing import Any, Dict, List, Mapping, TypedDict

from sentry.dynamic_sampling import get_redis_client_for_ds
from sentry.utils import json


class SerializedRule(TypedDict, total=True):
    """
    The format of the rule data stored in Redis

    All rules for one org are stored in a Redis hash.
    NOTE: the key only contains the condition you can't have the same condition
    applied to different projects with different expiration dates.
    If a condition should be applied to many projects a single rule should be created

    """

    condition: Dict[str, Any]  # the rule condition parsed from the query
    expiration: float  # the timestamp of the rule's expiration (UNIX timestamp)
    project_ids: List[int]  # list of project ids applicable to this rule
    org_id: int  # the organization id


def get_rule_hash(rule: SerializedRule) -> str:
    """
    Returns the hash of the rule based on the condition
    """
    condition_hash = hash_value(rule["condition"])
    # make it a bit shorter
    condition_hash = hashlib.sha1(condition_hash.encode("utf-8")).hexdigest()
    return condition_hash


def rule_from_json(val: str) -> SerializedRule:
    """
    Creates a SerializedRule from a json string
    """
    return json.loads(val)


def custom_rules_redis_key(org_id: int) -> str:
    """
    Returns the Redis key for the custom rules for an organization
    """
    return f"ds::o:{org_id}:custom-rules"


def hash_value(val: Any) -> str:
    """
    Converts a value in an order consistent string and then hashes it
    """
    ret_val = ""
    if isinstance(val, Mapping):
        for key in sorted(val.keys()):
            ret_val += f"{key}:{hash_value(val[key])}-"
    elif isinstance(val, (list, tuple)):
        for item in sorted(val):
            ret_val += f"{hash_value(item)}-"
    else:
        ret_val = str(val)
    return ret_val


def clen_expired_rules(org_id: int):
    """
    Cleans expired rules from an organization

    Concurrency warning:
    This is not 100% safe (but it is unlikely to cause issues)
    This should be done inside redis with a lua script
    Doing it in python risks deleting rules that have just been created
    The chance of two people creating rules at the exact same time and
    One of them creating a rule for a key that has expired exactly at the
    time the second person cleans the expired rules is very small and at
    worst would result in the rule from the first person not being created.
    """

    key = custom_rules_redis_key(org_id)
    redis_client = get_redis_client_for_ds()

    rules = redis_client.hgetall(key)

    now = datetime.utcnow().timestamp()

    for rule_key, rule_str in rules.items():
        rule = rule_from_json(rule_str)
        if rule["expiration"] < now:
            redis_client.hdel(key, rule_key)
