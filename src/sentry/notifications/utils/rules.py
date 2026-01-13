from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from sentry import options
from sentry.models.rule import Rule

RuleIdType = Literal["workflow_id", "legacy_rule_id"]


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
        key, _ = get_rule_or_workflow_id(rule)
        match key:
            case "workflow_id":
                workflow_rules.append(rule)
            case "legacy_rule_id":
                parsed_rules.append(rule)
    return RulesAndWorkflows(rules=parsed_rules, workflow_rules=workflow_rules)


def get_rule_or_workflow_id_default() -> str:
    if options.get("workflow_engine.default_workflow_links"):
        return "workflow_id"
    return "legacy_rule_id"


def get_rule_or_workflow_id(rule: Rule) -> tuple[RuleIdType, str]:
    keys = ["legacy_rule_id", "workflow_id"]
    if options.get("workflow_engine.default_workflow_links"):
        keys = ["workflow_id", "legacy_rule_id"]

    for key in keys:
        try:
            return (key, get_key_from_rule_data(rule, key))
        except AssertionError:
            pass
    return (get_rule_or_workflow_id_default(), str(rule.id))
