from collections.abc import Sequence
from dataclasses import dataclass

from sentry.models.rule import Rule


def get_key_from_rule_data(rule: Rule, key: str) -> str:
    value = rule.data.get("actions", [{}])[0].get(key)
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
        try:
            key, _ = get_rule_or_workflow_id(rule)
            if key == "workflow_id":
                workflow_rules.append(rule)
            else:
                parsed_rules.append(rule)
        except AssertionError:
            parsed_rules.append(rule)
    return RulesAndWorkflows(rules=parsed_rules, workflow_rules=workflow_rules)


def get_rule_or_workflow_id(rule: Rule) -> tuple[str, int]:
    try:
        return ("legacy_rule_id", int(get_key_from_rule_data(rule, "legacy_rule_id")))
    except AssertionError:
        pass

    try:
        return ("workflow_id", int(get_key_from_rule_data(rule, "workflow_id")))
    except AssertionError:
        return ("legacy_rule_id", rule.id)
