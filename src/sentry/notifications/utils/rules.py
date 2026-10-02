from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from sentry.notifications.types import NotificationRule

RuleIdType = Literal["workflow_id", "legacy_rule_id"]


@dataclass
class RulesAndWorkflows:
    rules: list[NotificationRule]
    workflow_rules: list[NotificationRule]


def split_rules_by_rule_workflow_id(
    rules: Sequence[NotificationRule],
) -> RulesAndWorkflows:
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
    rule: NotificationRule, *, prefer: RuleIdType = "legacy_rule_id"
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
        value = rule.workflow_id if key == "workflow_id" else rule.legacy_rule_id
        if value is not None:
            return (key, str(value))
    raise AssertionError("NotificationRule must have a workflow or legacy rule ID")
