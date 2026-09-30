from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from sentry.models.rule import Rule
from sentry.notifications.types import NotificationRule

RuleIdType = Literal["workflow_id", "legacy_rule_id"]


def get_legacy_rule_id(rule: Rule | NotificationRule) -> int | None:
    if isinstance(rule, Rule):
        return rule.id
    return rule.legacy_rule_id


def get_key_from_rule_data(rule: Rule | NotificationRule, key: str) -> str:
    if isinstance(rule, NotificationRule):
        if key == "legacy_rule_id":
            value = rule.legacy_rule_id
        elif key == "workflow_id":
            value = rule.workflow_id
        else:
            raise KeyError(key)
        assert value is not None
        return str(value)

    value = rule.data.get("actions", [{}])[0].get(key)
    assert value is not None
    return value


@dataclass
class RulesAndWorkflows[RuleT: Rule | NotificationRule]:
    rules: list[RuleT]
    workflow_rules: list[RuleT]


def split_rules_by_rule_workflow_id[RuleT: Rule | NotificationRule](
    rules: Sequence[RuleT],
) -> RulesAndWorkflows[RuleT]:
    parsed_rules = []
    workflow_rules = []
    for rule in rules:
        key, _ = get_rule_or_workflow_id(rule)
        match key:
            case "workflow_id":
                workflow_rules.append(rule)
            case "legacy_rule_id":
                parsed_rules.append(rule)
    return RulesAndWorkflows(rules=parsed_rules, workflow_rules=workflow_rules)


def get_rule_or_workflow_id(
    rule: Rule | NotificationRule, *, prefer: RuleIdType = "legacy_rule_id"
) -> tuple[RuleIdType, str]:
    """
    Returns which id the rule data carries, and its value. When both a legacy
    rule id and a workflow id are present, `prefer` decides which one wins.
    """
    keys: tuple[RuleIdType, RuleIdType] = (
        ("workflow_id", "legacy_rule_id")
        if prefer == "workflow_id"
        else ("legacy_rule_id", "workflow_id")
    )
    for key in keys:
        try:
            return (key, get_key_from_rule_data(rule, key))
        except AssertionError:
            pass
    if isinstance(rule, Rule):
        return ("legacy_rule_id", str(rule.id))
    raise AssertionError("NotificationRule must have a workflow or legacy rule ID")
