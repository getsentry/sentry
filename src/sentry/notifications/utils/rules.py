from collections.abc import Iterable
from typing import Literal

from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.notifications.types import NotificationOrigin
from sentry.workflow_engine.models import AlertRuleWorkflow, Workflow

RuleIdType = Literal["workflow_id", "legacy_rule_id"]


def get_notification_origins(
    project: Project,
    *,
    workflow_ids: Iterable[int] = (),
    legacy_rule_ids: Iterable[int] = (),
) -> list[NotificationOrigin]:
    """Resolve callback IDs to workflow-backed notification origins.

    Workflow IDs are authoritative. Legacy rule IDs are accepted for compatibility
    and mapped through AlertRuleWorkflow. IDs without a workflow in the project's
    organization are omitted.
    """
    workflow_ids = list(dict.fromkeys(workflow_ids))
    legacy_rule_ids = list(dict.fromkeys(legacy_rule_ids))

    links = list(
        AlertRuleWorkflow.objects.filter(workflow_id__in=workflow_ids, rule_id__isnull=False)
    )
    linked_workflow_ids = {link.workflow_id for link in links}
    links.extend(
        AlertRuleWorkflow.objects.filter(rule_id__in=legacy_rule_ids).exclude(
            workflow_id__in=linked_workflow_ids
        )
    )
    rule_id_by_workflow_id = {link.workflow_id: link.rule_id for link in links}
    workflow_id_by_rule_id = {
        link.rule_id: link.workflow_id for link in links if link.rule_id is not None
    }

    all_workflow_ids = {*workflow_ids, *workflow_id_by_rule_id.values()}
    workflows = Workflow.objects.filter(organization_id=project.organization_id).in_bulk(
        all_workflow_ids
    )

    origins = []
    seen_workflow_ids = set()
    for workflow_id in workflow_ids:
        workflow = workflows.get(workflow_id)
        if workflow is None:
            continue
        seen_workflow_ids.add(workflow_id)
        origins.append(
            NotificationOrigin(
                label=workflow.name,
                environment_id=workflow.environment_id,
                workflow_id=workflow_id,
                legacy_rule_id=rule_id_by_workflow_id.get(workflow_id),
            )
        )

    for legacy_rule_id in legacy_rule_ids:
        linked_workflow_id = workflow_id_by_rule_id.get(legacy_rule_id)
        if linked_workflow_id is None or linked_workflow_id in seen_workflow_ids:
            continue
        workflow = workflows.get(linked_workflow_id)
        if workflow is None:
            continue
        seen_workflow_ids.add(linked_workflow_id)
        origins.append(
            NotificationOrigin(
                label=workflow.name,
                environment_id=workflow.environment_id,
                workflow_id=linked_workflow_id,
                legacy_rule_id=legacy_rule_id,
            )
        )

    return origins


def get_key_from_rule_data(rule: Rule | NotificationOrigin, key: str) -> str:
    if isinstance(rule, NotificationOrigin):
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


def get_rule_or_workflow_id(
    rule: Rule | NotificationOrigin, *, prefer: RuleIdType = "legacy_rule_id"
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
    raise AssertionError("Notification origin requires a workflow or legacy rule ID")
