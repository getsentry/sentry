from typing import Any

from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.models.alert_rule import AlertRule
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.users.services.user import RpcUser
from sentry.workflow_engine.models import (
    AlertRuleDetector,
    AlertRuleWorkflow,
    DataConditionGroup,
    DataSource,
    Detector,
    DetectorState,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.types import DetectorPriorityLevel


def create_metric_alert_lookup_tables(
    alert_rule: AlertRule,
    detector: Detector,
    workflow: Workflow,
    data_source: DataSource,
    data_condition_group: DataConditionGroup,
) -> tuple[AlertRuleDetector, AlertRuleWorkflow, DetectorWorkflow, WorkflowDataConditionGroup]:
    alert_rule_detector = AlertRuleDetector.objects.create(alert_rule=alert_rule, detector=detector)
    alert_rule_workflow = AlertRuleWorkflow.objects.create(alert_rule=alert_rule, workflow=workflow)
    detector_workflow = DetectorWorkflow.objects.create(detector=detector, workflow=workflow)
    workflow_data_condition_group = WorkflowDataConditionGroup.objects.create(
        condition_group=data_condition_group, workflow=workflow
    )
    return (
        alert_rule_detector,
        alert_rule_workflow,
        detector_workflow,
        workflow_data_condition_group,
    )


def create_data_source(
    organization_id: int, snuba_query: SnubaQuery | None = None
) -> DataSource | None:
    if not snuba_query:
        return None

    try:
        query_subscription = QuerySubscription.objects.get(snuba_query=snuba_query.id)
    except QuerySubscription.DoesNotExist:
        return None

    return DataSource.objects.create(
        organization_id=organization_id,
        query_id=query_subscription.id,
        type="snuba_query_subscription",
    )


def create_data_condition_group(organization_id: int) -> DataConditionGroup:
    return DataConditionGroup.objects.create(
        logic_type=DataConditionGroup.Type.ANY,
        organization_id=organization_id,
    )


def create_workflow(
    name: str,
    organization_id: int,
    data_condition_group: DataConditionGroup,
    user: RpcUser | None = None,
) -> Workflow:
    return Workflow.objects.create(
        name=name,
        organization_id=organization_id,
        when_condition_group=data_condition_group,
        enabled=True,
        created_by_id=user.id if user else None,
        config={},
    )


def create_detector(
    alert_rule: AlertRule,
    project_id: int,
    data_condition_group: DataConditionGroup,
    user: RpcUser | None = None,
) -> Detector:
    return Detector.objects.create(
        project_id=project_id,
        enabled=True,
        created_by_id=user.id if user else None,
        name=alert_rule.name,
        workflow_condition_group=data_condition_group,
        type=MetricAlertFire.slug,
        description=alert_rule.description,
        owner_user_id=alert_rule.user_id,
        owner_team=alert_rule.team,
        config={  # TODO create a schema
            "threshold_period": alert_rule.threshold_period,
            "sensitivity": alert_rule.sensitivity,
            "seasonality": alert_rule.seasonality,
            "comparison_delta": alert_rule.comparison_delta,
        },
    )


def migrate_alert_rule(
    alert_rule: AlertRule,
    user: RpcUser | None = None,
) -> (
    tuple[
        DataSource,
        DataConditionGroup,
        Workflow,
        Detector,
        DetectorState,
        AlertRuleDetector,
        AlertRuleWorkflow,
        DetectorWorkflow,
        WorkflowDataConditionGroup,
    ]
    | None
):
    organization_id = alert_rule.organization_id
    project = alert_rule.projects.first()
    if not project:
        return None

    data_source = create_data_source(organization_id, alert_rule.snuba_query)
    if not data_source:
        return None

    data_condition_group = create_data_condition_group(organization_id)
    workflow = create_workflow(alert_rule.name, organization_id, data_condition_group, user)
    detector = create_detector(alert_rule, project.id, data_condition_group, user)

    data_source.detectors.set([detector])
    detector_state = DetectorState.objects.create(
        detector=detector,
        active=False,
        state=DetectorPriorityLevel.OK,
    )
    alert_rule_detector, alert_rule_workflow, detector_workflow, workflow_data_condition_group = (
        create_metric_alert_lookup_tables(
            alert_rule, detector, workflow, data_source, data_condition_group
        )
    )
    return (
        data_source,
        data_condition_group,
        workflow,
        detector,
        detector_state,
        alert_rule_detector,
        alert_rule_workflow,
        detector_workflow,
        workflow_data_condition_group,
    )


def update_migrated_alert_rule(alert_rule: AlertRule, updated_fields: dict[str, Any]) -> (
    tuple[
        DetectorState,
        Detector,
    ]
    | None
):
    # TODO: maybe pull this into a helper method?
    try:
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=alert_rule)
    except AlertRuleDetector.DoesNotExist:
        # logger.exception(
        #     "AlertRuleDetector does not exist",
        #     extra={"alert_rule_id": AlertRule.id},
        # )
        return None

    detector = alert_rule_detector.detector

    try:
        detector_state = DetectorState.objects.get(detector=detector)
    except DetectorState.DoesNotExist:
        # logger.exception(
        #     "DetectorState does not exist",
        #     extra={"alert_rule_id": AlertRule.id, "detector_id": detector.id},
        # )
        return None

    updated_detector_fields: dict[str:Any] = {}
    config = detector.config.copy()

    if "name" in updated_fields:
        updated_detector_fields["name"] = updated_fields["name"]
    if "description" in updated_fields:
        updated_detector_fields["description"] = updated_fields["description"]
    if "user_id" in updated_fields:
        updated_detector_fields["owner_user_id"] = updated_fields["user_id"]
    if "team_id" in updated_fields:
        updated_detector_fields["owner_team_id"] = updated_fields["team_id"]
    # update config fields
    if "threshold_period" in updated_fields:
        config["threshold_period"] = updated_fields["threshold_period"]
    if "sensitivity" in updated_fields:
        config["sensitivity"] = updated_fields["sensitivity"]
    if "seasonality" in updated_fields:
        config["seasonality"] = updated_fields["seasonality"]
    if "comparison_delta" in updated_fields:
        config["comparison_delta"] = updated_fields["comparison_delta"]
    updated_detector_fields["config"] = config

    detector.update(**updated_detector_fields)

    # reset detector status, as the rule was updated
    updated_status = {
        "active": False,
        "state": DetectorPriorityLevel.OK,
    }
    detector_state.update(**updated_status)

    # TODO: if the user updated resolve_threshold or threshold_type, then we also need to update the DataConditions

    # TODO: do we need to create an audit log entry here?
    return detector_state, detector
