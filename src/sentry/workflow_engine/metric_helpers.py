from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleThresholdType,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
)
from sentry.snuba.models import QuerySubscription
from sentry.users.services.user import RpcUser
from sentry.workflow_engine.models import (
    Action,
    AlertRuleDetector,
    AlertRuleTriggerDataCondition,
    AlertRuleWorkflow,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    DataSource,
    Detector,
    DetectorState,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import Condition, ConditionType
from sentry.workflow_engine.types import ActionType, DataSourceType, DetectorPriorityLevel


def create_metric_action(alert_rule_trigger_action: AlertRuleTriggerAction) -> None:
    try:
        alert_rule_trigger_data_condition = AlertRuleTriggerDataCondition.objects.get(
            alert_rule_trigger=alert_rule_trigger_action.alert_rule_trigger
        )
    except AlertRuleTriggerDataCondition.DoesNotExist:
        return None

    data = {
        "type": alert_rule_trigger_action.type,
        "sentry_app_id": alert_rule_trigger_action.sentry_app_id,
        "sentry_app_config": alert_rule_trigger_action.sentry_app_config,
    }
    action = Action.objects.create(
        required=False,
        type=ActionType.NOTIFICATION,
        data=data,
        integration_id=alert_rule_trigger_action.integration_id,
        target_display=alert_rule_trigger_action.target_display,
        target_identifier=alert_rule_trigger_action.target_identifier,
        target_type=alert_rule_trigger_action.target_type,
    )
    DataConditionGroupAction.objects.create(
        condition_group_id=alert_rule_trigger_data_condition.data_condition.condition_group.id,
        action_id=action.id,
    )


def create_metric_data_condition(alert_rule_trigger: AlertRuleTrigger) -> None:
    try:
        alert_rule_detector = AlertRuleDetector.objects.get(
            alert_rule=alert_rule_trigger.alert_rule
        )
    except AlertRuleDetector.DoesNotExist:
        return None

    threshold_to_condition = {
        AlertRuleThresholdType.ABOVE.value: Condition.GREATER,
        AlertRuleThresholdType.BELOW.value: Condition.LESS,
        AlertRuleThresholdType.ABOVE_AND_BELOW.value: Condition.ABOVE_AND_BELOW,
    }

    data_condition_group = alert_rule_detector.detector.workflow_condition_group
    if not data_condition_group:
        return None

    condition_result = (
        DetectorPriorityLevel.MEDIUM
        if alert_rule_trigger.label == "warning"
        else DetectorPriorityLevel.HIGH
    )
    threshold_type = alert_rule_trigger.alert_rule.threshold_type
    if not threshold_type:
        return None
    # XXX: we read the threshold type off of the alert_rule and NOT the alert_rule_trigger
    # alert_rule_trigger.threshold_type is a deprecated feature we are not moving over

    data_condition = DataCondition.objects.create(
        condition=threshold_to_condition.get(threshold_type, AlertRuleThresholdType.ABOVE.value),
        comparison=alert_rule_trigger.alert_threshold,
        condition_result=condition_result,
        type=ConditionType.METRIC_CONDITION,
        condition_group=data_condition_group,
    )
    AlertRuleTriggerDataCondition.objects.create(
        alert_rule_trigger=alert_rule_trigger, data_condition=data_condition
    )


def create_metric_alert_lookup_tables(
    alert_rule: AlertRule,
    detector: Detector,
    workflow: Workflow,
    data_source: DataSource,
    data_condition_group: DataConditionGroup,
) -> None:
    AlertRuleDetector.objects.create(alert_rule=alert_rule, detector=detector)
    AlertRuleWorkflow.objects.create(alert_rule=alert_rule, workflow=workflow)
    DetectorWorkflow.objects.create(detector=detector, workflow=workflow)
    WorkflowDataConditionGroup.objects.create(
        condition_group=data_condition_group, workflow=workflow
    )


def create_metric_detector_and_workflow(
    alert_rule: AlertRule,
    user: RpcUser | None = None,
) -> None:
    snuba_query = alert_rule.snuba_query
    if not snuba_query:
        return None

    project = alert_rule.projects.first()
    if not project:
        return None

    try:
        query_subscription = QuerySubscription.objects.get(snuba_query=snuba_query.id)
    except QuerySubscription.DoesNotExist:
        return None

    data_source = DataSource.objects.create(
        organization_id=alert_rule.organization_id,
        query_id=query_subscription.id,
        type=DataSourceType.SNUBA_QUERY_SUBSCRIPTION,
    )
    data_condition_group = DataConditionGroup.objects.create(
        logic_type=DataConditionGroup.Type.ANY,
        organization_id=alert_rule.organization_id,
    )
    workflow = Workflow.objects.create(
        name=alert_rule.name,
        organization_id=alert_rule.organization_id,
        when_condition_group=data_condition_group,
        enabled=True,
        created_by_id=user.id if user else None,
    )

    detector = Detector.objects.create(
        project_id=project.id,
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
    detector.data_sources.set([data_source])
    data_source.detectors.set([detector])
    DetectorState.objects.create(
        detector=detector,
        active=False,
        state=DetectorPriorityLevel.OK,
    )
    create_metric_alert_lookup_tables(
        alert_rule, detector, workflow, data_source, data_condition_group
    )
