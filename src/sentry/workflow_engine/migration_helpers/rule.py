from typing import Any

from sentry.issues.grouptype import ErrorGroupType
from sentry.models.organization import Organization
from sentry.models.rule import Rule
from sentry.rules.processing.processor import split_conditions_and_filters
from sentry.users.services.user import RpcUser
from sentry.workflow_engine.migration_helpers.issue_alert_conditions import (
    translate_to_data_condition,
)
from sentry.workflow_engine.models import (
    AlertRuleDetector,
    AlertRuleWorkflow,
    DataConditionGroup,
    Detector,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)


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
    config = {"frequency": frequency or 30}
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
