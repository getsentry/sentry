from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Literal

from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.notifications.types import NotificationRule
from sentry.workflow_engine.models import AlertRuleWorkflow, Workflow

RuleIdType = Literal["workflow_id", "legacy_rule_id"]


def get_notification_rules(
    project: Project,
    *,
    legacy_rule_ids: Iterable[int] = (),
    workflow_ids: Iterable[int] = (),
) -> list[NotificationRule]:
    workflow_ids = list(dict.fromkeys(workflow_ids))
    legacy_rule_ids = list(dict.fromkeys(legacy_rule_ids))
    workflows = Workflow.objects.filter(organization_id=project.organization_id).in_bulk(
        workflow_ids
    )
    workflow_links = {
        link.workflow_id: link.rule_id
        for link in AlertRuleWorkflow.objects.filter(
            workflow_id__in=workflows, rule_id__isnull=False
        )
    }
    rules = Rule.objects.filter(project_id=project.id).in_bulk(
        {*legacy_rule_ids, *workflow_links.values()}
    )

    notification_rules = []
    linked_rule_ids = set()
    for workflow_id in workflow_ids:
        workflow = workflows.get(workflow_id)
        if workflow is None:
            continue

        legacy_rule_id = workflow_links.get(workflow_id)
        legacy_rule = rules.get(legacy_rule_id) if legacy_rule_id is not None else None
        if legacy_rule is not None:
            linked_rule_ids.add(legacy_rule.id)
            notification_rules.append(
                NotificationRule.from_deprecated_legacy_rule(
                    legacy_rule, project=project, workflow_id=workflow_id
                )
            )
        else:
            notification_rules.append(
                NotificationRule(
                    id=workflow_id,
                    label=workflow.name,
                    data={"actions": [{"workflow_id": workflow_id}]},
                    project=project,
                    environment_id=workflow.environment_id,
                    workflow_id=workflow_id,
                    legacy_rule_id=None,
                )
            )

    notification_rules.extend(
        NotificationRule.from_deprecated_legacy_rule(rule, project=project)
        for rule_id in legacy_rule_ids
        if rule_id not in linked_rule_ids and (rule := rules.get(rule_id)) is not None
    )
    return notification_rules


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
