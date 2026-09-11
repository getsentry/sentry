from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from sentry.models.rule import Rule

RuleIdType = Literal["workflow_id", "legacy_rule_id"]


def get_key_from_rule_data(rule: Rule, key: str) -> str:
    # actions may be missing or empty for some workflow/rule shapes; treat as [{}]
    # so we raise AssertionError (handled by callers) instead of IndexError.
    actions = rule.data.get("actions") or [{}]
    first_action = actions[0] if isinstance(actions[0], dict) else {}
    value = first_action.get(key)
    assert value is not None
    return value


@dataclass
class RulesAndWorkflows:
    rules: list[Rule]
    workflow_rules: list[Rule]  # workflows as fake Rules


def split_rules_by_rule_workflow_id(rules: Sequence[Rule]) -> RulesAndWorkflows:
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


def get_rule_or_workflow_id(rule: Rule) -> tuple[RuleIdType, str]:
    try:
        return ("legacy_rule_id", get_key_from_rule_data(rule, "legacy_rule_id"))
    except AssertionError:
        pass

    try:
        return ("workflow_id", get_key_from_rule_data(rule, "workflow_id"))
    except AssertionError:
        return ("legacy_rule_id", str(rule.id))
