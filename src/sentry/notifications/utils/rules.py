from typing import int
from sentry.models.rule import Rule


def get_key_from_rule_data(rule: Rule, key: str) -> str:
    value = rule.data.get("actions", [{}])[0].get(key)
    assert value is not None
    return value
