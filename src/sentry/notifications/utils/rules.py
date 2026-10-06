import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from sentry import options
from sentry.models.rule import Rule
from sentry.notifications.types import TEST_NOTIFICATION_ID
from sentry.utils import metrics

logger = logging.getLogger(__name__)

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


def get_rule_or_workflow_id(
    rule: Rule, *, prefer: RuleIdType = "legacy_rule_id"
) -> tuple[RuleIdType, str]:
    """
    Returns which id the rule data carries, and its value. When both a legacy
    rule id and a workflow id are present, the rollout option prefers workflow
    data; otherwise, `prefer` decides which one wins.
    """
    use_workflow_data = options.get("workflow_engine.notifications.use_workflow_data")
    keys: tuple[RuleIdType, RuleIdType] = (
        ("workflow_id", "legacy_rule_id")
        if use_workflow_data or prefer == "workflow_id"
        else ("legacy_rule_id", "workflow_id")
    )
    for key in keys:
        try:
            value = get_key_from_rule_data(rule, key)
        except AssertionError:
            continue
        break
    else:
        key = "legacy_rule_id"
        value = str(rule.id)

    if use_workflow_data and key == "legacy_rule_id" and str(value) != str(TEST_NOTIFICATION_ID):
        metrics.incr("notifications.legacy_rule_id_fallback")
        logger.info(
            "notifications.legacy_rule_id_fallback",
            extra={"rule_id": value, "project_id": rule.project_id},
        )
    return (key, value)
