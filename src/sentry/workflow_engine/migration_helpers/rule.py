import logging
from typing import Any, TypedDict

from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.organization import Organization
from sentry.models.rule import Rule
from sentry.rules.processing.processor import split_conditions_and_filters
from sentry.types.actor import Actor
from sentry.users.services.user import RpcUser
from sentry.workflow_engine.migration_helpers.issue_alert_conditions import (
    translate_to_data_condition,
)
from sentry.workflow_engine.models import (
    AlertRuleDetector,
    AlertRuleWorkflow,
    DataCondition,
    DataConditionGroup,
    Detector,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)

logger = logging.getLogger(__name__)


def migrate_issue_alert(rule: Rule, user: RpcUser | None = None):
    data = rule.data
    project = rule.project
    organization = project.organization

    error_detector, _ = Detector.objects.get_or_create(
        type=ErrorGroupType.slug, project=project, defaults={"config": {}, "name": "Error Detector"}
    )
    AlertRuleDetector.objects.create(detector=error_detector, rule=rule)

    conditions, filters = split_conditions_and_filters(data["conditions"])
    when_dcg = create_when_dcg(
        organization=organization, conditions=conditions, action_match=data["action_match"]
    )
    workflow = create_workflow(
        organization=organization,
        rule=rule,
        detector=error_detector,
        when_condition_group=when_dcg,
        user_id=user.id if user else None,
        environment_id=rule.environment_id,
    )
    AlertRuleWorkflow.objects.create(rule=rule, workflow=workflow)

    if_dcg = create_if_dcg(
        workflow=workflow, filters=filters, filter_match=data.get("filter_match")
    )
    create_workflow_actions(if_dcg=if_dcg, actions=data["actions"])  # action(s) must exist


def create_when_dcg(
    organization: Organization, conditions: list[dict[str, Any]], action_match: str
):
    if action_match == "any":
        action_match = DataConditionGroup.Type.ANY_SHORT_CIRCUIT.value

    when_dcg = DataConditionGroup.objects.create(logic_type=action_match, organization=organization)
    for condition in conditions:
        translate_to_data_condition(dict(condition), dcg=when_dcg)

    return when_dcg


def create_workflow(
    organization: Organization,
    rule: Rule,
    detector: Detector,
    when_condition_group: DataConditionGroup,
    user_id: int | None = None,
    frequency: int | None = None,
    environment_id: int | None = None,
):
    config = {"frequency": frequency or Workflow.DEFAULT_FREQUENCY}
    workflow = Workflow.objects.create(
        organization=organization,
        name=rule.label,
        environment_id=environment_id,
        when_condition_group=when_condition_group,
        created_by_id=user_id,
        owner_user_id=rule.owner_user_id,
        owner_team=rule.owner_team,
        config=config,
    )

    DetectorWorkflow.objects.create(detector=detector, workflow=workflow)

    return workflow


def create_if_dcg(
    workflow: Workflow, filters: list[dict[str, Any]], filter_match: str | None = None
):
    if (
        filter_match == "any" or filter_match is None
    ):  # must create IF DCG even if it's empty, to attach actions
        filter_match = DataConditionGroup.Type.ANY_SHORT_CIRCUIT.value

    if_dcg = DataConditionGroup.objects.create(
        logic_type=filter_match, organization=workflow.organization
    )
    WorkflowDataConditionGroup.objects.create(workflow=workflow, condition_group=if_dcg)

    for filter in filters:
        translate_to_data_condition(dict(filter), dcg=if_dcg)

    return if_dcg


def create_workflow_actions(if_dcg: DataConditionGroup, actions: list[dict[str, Any]]):
    # TODO: create actions, need registry
    pass


class UpdatedIssueAlertData(TypedDict):
    name: str
    conditions: list[dict[str, Any]]
    action_match: str
    filter_match: str | None
    actions: list[dict[str, Any]]
    environment: int | None
    owner: Actor | None
    frequency: int | None


def update_migrated_issue_alert(rule: Rule, data: UpdatedIssueAlertData):
    try:
        alert_rule_workflow = AlertRuleWorkflow.objects.get(rule=rule)
    except AlertRuleWorkflow.DoesNotExist:
        logger.exception("AlertRuleWorkflow does not exist", extra={"rule_id": rule.id})
        return

    workflow: Workflow = alert_rule_workflow.workflow
    if not workflow.when_condition_group:
        logger.error(
            "Workflow does not have a when_condition_group", extra={"workflow_id": workflow.id}
        )
        return

    conditions, filters = split_conditions_and_filters(data["conditions"])

    update_dcg(
        dcg=workflow.when_condition_group,
        conditions=conditions,
        match=data["action_match"],
    )

    try:
        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
    except WorkflowDataConditionGroup.DoesNotExist:
        logger.exception(
            "WorkflowDataConditionGroup does not exist", extra={"workflow_id": workflow.id}
        )
        # if no IF DCG exists, create one
        if_dcg = create_if_dcg(
            workflow=workflow, filters=filters, filter_match=data["filter_match"]
        )
        WorkflowDataConditionGroup.objects.create(workflow=workflow, condition_group=if_dcg)

    update_dcg(dcg=if_dcg, conditions=filters, match=data["filter_match"])

    delete_workflow_actions(if_dcg=if_dcg)
    create_workflow_actions(if_dcg=if_dcg, actions=data["actions"])  # action(s) must exist

    updated_data: dict[str, Any] = {
        "name": data["name"],
        "environment_id": data["environment"],
        "enabled": True,
        "owner_team_id": None,
        "owner_user_id": None,
        "config": {"frequency": data["frequency"] or Workflow.DEFAULT_FREQUENCY},
    }
    owner = data["owner"]
    if owner:
        if owner and owner.is_user:
            updated_data["owner_user_id"] = owner.id
        if owner and owner.is_team:
            updated_data["owner_team_id"] = owner.id
    workflow.update(**updated_data)


def update_dcg(
    dcg: DataConditionGroup,
    conditions: list[dict[str, Any]],
    match: str | None = None,
):
    DataCondition.objects.filter(condition_group=dcg).delete()

    if dcg.logic_type != match:
        if match == "any" or match is None:
            match = DataConditionGroup.Type.ANY_SHORT_CIRCUIT.value

        dcg.update(logic_type=match)

    for condition in conditions:
        translate_to_data_condition(dict(condition), dcg=dcg)

    return dcg


def delete_migrated_issue_alert(rule: Rule):
    try:
        alert_rule_workflow = AlertRuleWorkflow.objects.get(rule=rule)
    except AlertRuleWorkflow.DoesNotExist:
        logger.exception("AlertRuleWorkflow does not exist", extra={"rule_id": rule.id})
        return

    workflow: Workflow = alert_rule_workflow.workflow

    try:
        # delete all associated IF DCGs and their conditions
        workflow_dcgs = WorkflowDataConditionGroup.objects.filter(workflow=workflow)
        for workflow_dcg in workflow_dcgs:
            if_dcg = workflow_dcg.condition_group
            if_dcg.conditions.all().delete()
            if_dcg.delete()

    except WorkflowDataConditionGroup.DoesNotExist:
        logger.exception(
            "WorkflowDataConditionGroup does not exist", extra={"workflow_id": workflow.id}
        )

    if not workflow.when_condition_group:
        logger.error(
            "Workflow does not have a when_condition_group", extra={"workflow_id": workflow.id}
        )
    else:
        when_dcg = workflow.when_condition_group
        when_dcg.conditions.all().delete()
        when_dcg.delete()

    workflow.delete()
    alert_rule_workflow.delete()


def delete_workflow_actions(if_dcg: DataConditionGroup):
    # TODO: delete actions, need registry
    pass
