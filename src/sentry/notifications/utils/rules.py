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


def get_rule_or_workflow_id(rule: Rule) -> tuple[RuleIdType, str]:
    if options.get("workflow_engine.notifications.use_workflow_data"):
        # We're trying to fully avoid using persisted Rule data, so we use
        # workflow_id by default and only use the legacy ID if we have to.
        try:
            return ("workflow_id", get_key_from_rule_data(rule, "workflow_id"))
        except AssertionError:
            pass

        try:
            legacy_rule_id = get_key_from_rule_data(rule, "legacy_rule_id")
        except AssertionError:
            legacy_rule_id = str(rule.id)

        if str(legacy_rule_id) != str(TEST_NOTIFICATION_ID):
            metrics.incr("notifications.legacy_rule_id_fallback")
            logger.info(
                "notifications.legacy_rule_id_fallback",
                extra={"rule_id": legacy_rule_id, "project_id": rule.project_id},
            )

        return ("legacy_rule_id", legacy_rule_id)

    try:
        return ("legacy_rule_id", get_key_from_rule_data(rule, "legacy_rule_id"))
    except AssertionError:
        pass

    try:
        return ("workflow_id", get_key_from_rule_data(rule, "workflow_id"))
    except AssertionError:
        return ("legacy_rule_id", str(rule.id))
