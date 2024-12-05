from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
)
from sentry.models.project import Project
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.types.actor import Actor
from sentry.users.services.user import RpcUser
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    DataSource,
    DataSourceDetector,
    Detector,
    DetectorState,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.types import DataSourceType, DetectorPriorityLevel


def create_action(alert_rule_trigger_action: AlertRuleTriggerAction) -> None:
    data = {
        "type": alert_rule_trigger_action.type,
        "sentry_app_id": alert_rule_trigger_action.sentry_app_id,
        "sentry_app_config": alert_rule_trigger_action.sentry_app_config,
    }
    action = Action.objects.create(
        required=False,
        type="SendNotificationAction",  # TODO put in an enum somewhere
        data=data,
        integration_id=alert_rule_trigger_action.integration_id,
        target_display=alert_rule_trigger_action.target_display,
        target_identifier=alert_rule_trigger_action.target_identifier,
        target_type=alert_rule_trigger_action.target_type,
    )
    data_condition_group = (
        DataConditionGroup.objects.first()
    )  # TODO how do I get this if all I have is the alert rule?
    DataConditionGroupAction.objects.update_or_create(
        condition_group=data_condition_group.id,
        action=action.id,
    )


def create_data_condition(alert_rule_trigger: AlertRuleTrigger) -> None:
    data_condition_group = (
        DataConditionGroup.objects.first()
    )  # TODO how do I get this if all I have is the alert rule?
    DataCondition.objects.create(
        condition=alert_rule_trigger.threshold_type,  # why isn't this passed in create_alert_rule_trigger?
        comparison=alert_rule_trigger.alert_threshold,
        condition_result=alert_rule_trigger.label,
        type="MetricAlertFire",  # this probably isn't right
        condition_group=data_condition_group,
    )


def create_alert_lookup_tables(
    alert_rule: AlertRule,
    detector: Detector,
    workflow: Workflow,
    data_source: DataSource,
    data_condition_group: DataConditionGroup,
) -> None:
    # AlertRuleDetector lookup table TODO
    # AlertRuleWorkflow lookup table TODO
    DataSourceDetector.objects.create(data_source=data_source, detector=detector)
    DetectorWorkflow.objects.create(detector=detector, workflow=workflow)
    WorkflowDataConditionGroup.objects.create(
        condition_group=data_condition_group, workflow=workflow
    )


def create_detector_and_workflow(
    organization_id: int,
    project: Project,
    name: str,
    description: str,
    threshold_period: int,
    snuba_query: SnubaQuery,
    alert_rule: AlertRule,
    sensitivity: AlertRuleSensitivity | None = None,
    seasonality: AlertRuleSeasonality | None = None,
    comparison_delta: int | None = None,
    user: RpcUser | None = None,
    owner: Actor | None = None,
) -> None:

    query_subscription = QuerySubscription.objects.get(snuba_query=snuba_query.id)
    data_source = DataSource.objects.create(
        organization_id=organization_id,
        query_id=query_subscription.id,
        type=DataSourceType.SNUBA_QUERY_SUBSCRIPTION,
    )
    data_condition_group = DataConditionGroup.objects.create(
        logic_type=DataConditionGroup.Type.ANY,
        organization_id=organization_id,
    )
    workflow = Workflow.objects.create(
        name=name,
        organization_id=organization_id,
        when_condition_group=data_condition_group.id,
        enabled=True,
        created_by_id=user.id if user else None,
    )
    detector = Detector.objects.create(
        project_id=project.id,
        enabled=True,
        created_by_id=user.id,
        name=name,
        data_sources=data_source,
        workflow_condition_group=data_condition_group.id,
        type=MetricAlertFire.slug,
        description=description,
        owner_user_id=owner.id if owner.is_team else None,
        owner_team=owner.id if owner.is_user else None,
        config={  # TODO create a schema
            "threshold_period": threshold_period,
            "sensitivity": sensitivity,
            "seasonality": seasonality,
            "comparison_delta": comparison_delta,
        },
    )
    data_source.update(detectors=[detector])
    DetectorState.objects.create(
        detector=detector.id,
        active=False,
        state=DetectorPriorityLevel.OK,
    )
    create_alert_lookup_tables(alert_rule, detector, workflow, data_source, data_condition_group)
