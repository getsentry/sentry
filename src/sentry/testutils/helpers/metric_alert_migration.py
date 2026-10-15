import dataclasses
import logging
from typing import Any

from django.db import router, transaction
from django.forms import ValidationError

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleThresholdType,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.integrations.opsgenie.client import OPSGENIE_DEFAULT_PRIORITY
from sentry.integrations.pagerduty.client import PAGERDUTY_DEFAULT_SEVERITY
from sentry.notifications.models.notificationaction import ActionService
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.testutils.helpers.metric_alert_migration_utils import get_workflow_name
from sentry.users.services.user import RpcUser
from sentry.workflow_engine.models import (
    Action,
    ActionAlertRuleTriggerAction,
    AlertRuleDetector,
    AlertRuleWorkflow,
    DataCondition,
    DataConditionAlertRuleTrigger,
    DataConditionGroup,
    DataConditionGroupAction,
    DataSource,
    Detector,
    DetectorState,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import AlertRuleNotDualWritten, DetectorPriorityLevel
from sentry.workflow_engine.typings.notification_action import OnCallDataBlob, SentryAppDataBlob

logger = logging.getLogger(__name__)

PRIORITY_MAP = {
    "warning": DetectorPriorityLevel.MEDIUM,
    "critical": DetectorPriorityLevel.HIGH,
}

TYPE_TO_PROVIDER = {
    ActionService.EMAIL.value: Action.Type.EMAIL,
    ActionService.PAGERDUTY.value: Action.Type.PAGERDUTY,
    ActionService.SLACK.value: Action.Type.SLACK,
    ActionService.MSTEAMS.value: Action.Type.MSTEAMS,
    ActionService.SENTRY_APP.value: Action.Type.SENTRY_APP,
    ActionService.OPSGENIE.value: Action.Type.OPSGENIE,
    ActionService.DISCORD.value: Action.Type.DISCORD,
}


class MissingDataConditionGroup(Exception):
    pass


class UnresolvableResolveThreshold(Exception):
    pass


class CouldNotCreateDataSource(Exception):
    pass


def get_action_type(alert_rule_trigger_action: AlertRuleTriggerAction) -> Action.Type | None:
    return TYPE_TO_PROVIDER.get(alert_rule_trigger_action.type, None)


def build_sentry_app_data_blob(
    alert_rule_trigger_action: AlertRuleTriggerAction,
) -> dict[str, Any]:
    if not alert_rule_trigger_action.sentry_app_config:
        return {}
    # Convert config to proper type for SentryAppDataBlob
    settings = (
        [alert_rule_trigger_action.sentry_app_config]
        if isinstance(alert_rule_trigger_action.sentry_app_config, dict)
        else alert_rule_trigger_action.sentry_app_config
    )
    return dataclasses.asdict(SentryAppDataBlob.from_list(settings))


def build_on_call_data_blob(
    alert_rule_trigger_action: AlertRuleTriggerAction, action_type: Action.Type
) -> dict[str, Any]:
    default_priority = (
        OPSGENIE_DEFAULT_PRIORITY
        if action_type == Action.Type.OPSGENIE
        else PAGERDUTY_DEFAULT_SEVERITY
    )

    if not alert_rule_trigger_action.sentry_app_config:
        return {"priority": default_priority}

    # Ensure sentry_app_config is a dict before accessing
    config = alert_rule_trigger_action.sentry_app_config
    if not isinstance(config, dict):
        return {"priority": default_priority}

    priority = config.get("priority", default_priority)
    return dataclasses.asdict(OnCallDataBlob(priority=priority))


def build_action_data_blob(
    alert_rule_trigger_action: AlertRuleTriggerAction, action_type: Action.Type
) -> dict[str, Any]:
    # if the action is a Sentry app, we need to get the Sentry app installation ID
    if action_type == Action.Type.SENTRY_APP:
        return build_sentry_app_data_blob(alert_rule_trigger_action)
    elif action_type in (Action.Type.OPSGENIE, Action.Type.PAGERDUTY):
        return build_on_call_data_blob(alert_rule_trigger_action, action_type)
    else:
        return {}


def get_target_identifier(
    alert_rule_trigger_action: AlertRuleTriggerAction, action_type: Action.Type
) -> str | None:
    if action_type == Action.Type.SENTRY_APP:
        # Ensure we have a valid sentry_app_id
        if not alert_rule_trigger_action.sentry_app_id:
            raise ValidationError(
                f"sentry_app_id is required for Sentry App actions for alert rule trigger action {alert_rule_trigger_action.id}",
            )
        return str(alert_rule_trigger_action.sentry_app_id)
    # Ensure we have a valid target_identifier
    return alert_rule_trigger_action.target_identifier


def build_action_config(
    target_display: str | None, target_identifier: str | None, target_type: int
) -> dict[str, str | int | None]:
    return {
        "target_display": target_display,
        "target_identifier": target_identifier,
        "target_type": target_type,
    }


def get_action_filter(
    alert_rule_trigger: AlertRuleTrigger, priority: DetectorPriorityLevel
) -> DataCondition:
    """
    Helper method to find the action filter corresponding to an AlertRuleTrigger.
    Raises an exception if the action filter cannot be found.
    """
    alert_rule = alert_rule_trigger.alert_rule

    try:
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule_id=alert_rule.id)
    except AlertRuleWorkflow.DoesNotExist:
        raise AlertRuleNotDualWritten()

    workflow = alert_rule_workflow.workflow
    workflow_dcgs = DataConditionGroup.objects.filter(workflowdataconditiongroup__workflow=workflow)
    action_filter = DataCondition.objects.get(
        condition_group__in=workflow_dcgs,
        comparison=priority,
        type=Condition.ISSUE_PRIORITY_GREATER_OR_EQUAL,
    )
    return action_filter


def migrate_metric_action(
    alert_rule_trigger_action: AlertRuleTriggerAction,
) -> tuple[Action, DataConditionGroupAction, ActionAlertRuleTriggerAction]:
    alert_rule_trigger = alert_rule_trigger_action.alert_rule_trigger
    priority = PRIORITY_MAP.get(alert_rule_trigger.label, DetectorPriorityLevel.HIGH)
    action_filter = get_action_filter(alert_rule_trigger, priority)

    action_type = get_action_type(alert_rule_trigger_action)
    if not action_type:
        logger.warning(
            "Could not find a matching Action.Type for the trigger action",
            extra={"alert_rule_trigger_action_id": alert_rule_trigger_action.id},
        )
        raise ValidationError(
            f"Could not find a matching Action.Type for the trigger action {alert_rule_trigger_action.id}"
        )

    # Ensure action_type is Action.Type before passing to functions
    action_type_enum = Action.Type(action_type)
    data = build_action_data_blob(alert_rule_trigger_action, action_type_enum)
    target_identifier = get_target_identifier(alert_rule_trigger_action, action_type_enum)
    action_config = build_action_config(
        alert_rule_trigger_action.target_display,
        target_identifier,
        alert_rule_trigger_action.target_type,
    )

    action = Action.objects.create(
        type=action_type_enum,
        data=data,
        integration_id=alert_rule_trigger_action.integration_id,
        config=action_config,
    )
    data_condition_group_action = DataConditionGroupAction.objects.create(
        condition_group_id=action_filter.condition_group.id,
        action_id=action.id,
    )
    action_alert_rule_trigger_action = ActionAlertRuleTriggerAction.objects.create(
        action_id=action.id,
        alert_rule_trigger_action_id=alert_rule_trigger_action.id,
    )
    return action, data_condition_group_action, action_alert_rule_trigger_action


def migrate_metric_data_conditions(
    alert_rule_trigger: AlertRuleTrigger,
) -> tuple[DataCondition, DataCondition, DataCondition]:
    alert_rule = alert_rule_trigger.alert_rule
    # create a data condition for the Detector's data condition group with the
    # threshold and associated priority level
    alert_rule_detector = AlertRuleDetector.objects.select_related(
        "detector__workflow_condition_group"
    ).get(alert_rule_id=alert_rule.id)
    detector = alert_rule_detector.detector
    detector_data_condition_group = detector.workflow_condition_group
    if detector_data_condition_group is None:
        logger.error(
            "detector.workflow_condition_group does not exist", extra={"detector": detector}
        )
        raise MissingDataConditionGroup

    threshold_type = (
        Condition.GREATER
        if alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value
        else Condition.LESS
    )
    condition_result = PRIORITY_MAP.get(alert_rule_trigger.label, DetectorPriorityLevel.HIGH)

    if alert_rule.detection_type == AlertRuleDetectionType.DYNAMIC:
        detector_trigger = DataCondition.objects.create(
            type=Condition.ANOMALY_DETECTION,
            comparison={
                "sensitivity": alert_rule.sensitivity,
                "seasonality": alert_rule.seasonality,
                "threshold_type": alert_rule.threshold_type,
            },
            condition_result=condition_result,
            condition_group=detector_data_condition_group,
        )
    else:
        detector_trigger = DataCondition.objects.create(
            comparison=alert_rule_trigger.alert_threshold,
            condition_result=condition_result,
            type=threshold_type,
            condition_group=detector_data_condition_group,
        )
    DataConditionAlertRuleTrigger.objects.create(
        data_condition=detector_trigger,
        alert_rule_trigger_id=alert_rule_trigger.id,
    )
    # create an "action filter": if the detector's status matches a certain priority level,
    # then the condition result is set to true
    data_condition_group = DataConditionGroup.objects.create(
        organization_id=alert_rule.organization_id
    )
    alert_rule_workflow = AlertRuleWorkflow.objects.select_related("workflow").get(
        alert_rule_id=alert_rule.id
    )
    WorkflowDataConditionGroup.objects.create(
        condition_group=data_condition_group,
        workflow=alert_rule_workflow.workflow,
    )

    action_filter = DataCondition.objects.create(
        comparison=PRIORITY_MAP.get(alert_rule_trigger.label, DetectorPriorityLevel.HIGH),
        condition_result=True,
        type=Condition.ISSUE_PRIORITY_GREATER_OR_EQUAL,
        condition_group=data_condition_group,
    )
    # finally, create a "resolution action filter": the condition result is set to true
    # if we're de-escalating from the priority specified in the comparison
    resolve_action_filter = DataCondition.objects.create(
        comparison=PRIORITY_MAP.get(alert_rule_trigger.label, DetectorPriorityLevel.HIGH),
        condition_result=True,
        type=Condition.ISSUE_PRIORITY_DEESCALATING,
        condition_group=data_condition_group,
    )
    return detector_trigger, action_filter, resolve_action_filter


def get_resolve_threshold(detector_data_condition_group: DataConditionGroup) -> float:
    """
    Helper method to get the resolve threshold for a Detector if none is specified on
    the legacy AlertRule.
    """
    detector_triggers = DataCondition.objects.filter(condition_group=detector_data_condition_group)
    warning_data_condition = detector_triggers.filter(
        condition_result=DetectorPriorityLevel.MEDIUM
    ).first()
    if warning_data_condition is not None:
        resolve_threshold = warning_data_condition.comparison
    else:
        critical_data_condition = detector_triggers.filter(
            condition_result=DetectorPriorityLevel.HIGH
        ).first()
        if critical_data_condition is None:
            logger.error(
                "no critical or warning data conditions exist for detector data condition group",
                extra={"detector_data_condition_group": detector_triggers},
            )
            return -1
        else:
            resolve_threshold = critical_data_condition.comparison
    return resolve_threshold


def migrate_resolve_threshold_data_condition(
    alert_rule: AlertRule,
) -> DataCondition:
    """
    Create data conditions for the old world's "resolve" threshold. If a resolve threshold
    has been explicitly set on the alert rule, then use this as our comparison value. Otherwise,
    we need to figure out what the resolve threshold is based on the trigger threshold values.
    """
    alert_rule_detector = AlertRuleDetector.objects.select_related(
        "detector__workflow_condition_group"
    ).get(alert_rule_id=alert_rule.id)
    detector = alert_rule_detector.detector
    detector_data_condition_group = detector.workflow_condition_group
    if detector_data_condition_group is None:
        logger.error("workflow_condition_group does not exist", extra={"detector": detector})
        raise MissingDataConditionGroup

    # XXX: we set the resolve trigger's threshold_type to whatever the opposite of the rule's threshold_type is
    # e.g. if the rule has a critical trigger ABOVE some number, the resolve threshold is automatically set to BELOW
    threshold_type = (
        Condition.LESS_OR_EQUAL
        if alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value
        else Condition.GREATER_OR_EQUAL
    )

    if alert_rule.resolve_threshold is not None:
        resolve_threshold = alert_rule.resolve_threshold
    else:
        # figure out the resolve threshold ourselves
        resolve_threshold = get_resolve_threshold(detector_data_condition_group)
        if resolve_threshold == -1:
            # something went wrong
            raise UnresolvableResolveThreshold

    detector_trigger = DataCondition.objects.create(
        comparison=resolve_threshold,
        condition_result=DetectorPriorityLevel.OK,
        type=threshold_type,
        condition_group=detector_data_condition_group,
    )

    return detector_trigger


def create_metric_alert_lookup_tables(
    alert_rule: AlertRule,
    detector: Detector,
    workflow: Workflow,
) -> tuple[AlertRuleDetector, AlertRuleWorkflow, DetectorWorkflow]:
    alert_rule_detector = AlertRuleDetector.objects.create(
        alert_rule_id=alert_rule.id, detector=detector
    )
    alert_rule_workflow = AlertRuleWorkflow.objects.create(
        alert_rule_id=alert_rule.id, workflow=workflow
    )
    detector_workflow = DetectorWorkflow.objects.create(detector=detector, workflow=workflow)
    return (
        alert_rule_detector,
        alert_rule_workflow,
        detector_workflow,
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
        source_id=str(query_subscription.id),
        type="snuba_query_subscription",
    )


def create_data_condition_group(organization_id: int) -> DataConditionGroup:
    return DataConditionGroup.objects.create(
        organization_id=organization_id,
    )


def create_workflow(
    alert_rule: AlertRule,
    name: str,
    organization_id: int,
    user: RpcUser | None = None,
) -> Workflow:
    return Workflow.objects.create(
        name=name,
        organization_id=organization_id,
        when_condition_group=None,
        enabled=True,
        created_by_id=user.id if user else None,
        owner_user_id=alert_rule.user_id,
        owner_team_id=alert_rule.team_id,
        config={},
    )


def get_detector_field_values(
    alert_rule: AlertRule,
    data_condition_group: DataConditionGroup,
    project_id: int | None = None,
    user: RpcUser | None = None,
) -> dict[str, Any]:
    detector_field_values = {
        "name": alert_rule.name if len(alert_rule.name) < 200 else alert_rule.name[:197] + "...",
        "description": alert_rule.description,
        "workflow_condition_group": data_condition_group,
        "owner_user_id": alert_rule.user_id,
        "owner_team_id": alert_rule.team_id,
        "config": {
            "comparison_delta": alert_rule.comparison_delta,
            "detection_type": alert_rule.detection_type,
        },
    }
    if project_id is not None:
        # these fields are only set on create, not update
        detector_field_values.update(
            {
                "project_id": project_id,
                "enabled": True,
                "created_by_id": user.id if user else None,
                "type": MetricIssue.slug,
            }
        )
    return detector_field_values


def create_detector(
    alert_rule: AlertRule,
    project_id: int,
    data_condition_group: DataConditionGroup,
    user: RpcUser | None = None,
) -> Detector:
    detector_field_values = get_detector_field_values(
        alert_rule, data_condition_group, project_id, user
    )
    return Detector.objects.create(**detector_field_values)


def migrate_alert_rule(
    alert_rule: AlertRule,
    user: RpcUser | None = None,
) -> tuple[
    DataSource,
    DataConditionGroup,
    Workflow,
    Detector,
    DetectorState,
    AlertRuleDetector,
    AlertRuleWorkflow,
    DetectorWorkflow,
]:
    organization_id = alert_rule.organization_id
    project = alert_rule.projects.get()

    data_source = create_data_source(organization_id, alert_rule.snuba_query)
    if not data_source:
        raise CouldNotCreateDataSource

    detector_data_condition_group = create_data_condition_group(organization_id)
    detector = create_detector(alert_rule, project.id, detector_data_condition_group, user)

    workflow_name = get_workflow_name(alert_rule)
    workflow = create_workflow(alert_rule, workflow_name, organization_id, user)

    open_incident = Incident.objects.get_active_incident(alert_rule, project)
    if open_incident:
        state = (
            DetectorPriorityLevel.MEDIUM
            if open_incident.status == IncidentStatus.WARNING.value
            else DetectorPriorityLevel.HIGH
        )
    else:
        state = DetectorPriorityLevel.OK

    data_source.detectors.set([detector])
    detector_state = DetectorState.objects.create(
        detector=detector,
        is_triggered=True if open_incident else False,
        state=state,
    )
    alert_rule_detector, alert_rule_workflow, detector_workflow = create_metric_alert_lookup_tables(
        alert_rule, detector, workflow
    )
    return (
        data_source,
        detector_data_condition_group,
        workflow,
        detector,
        detector_state,
        alert_rule_detector,
        alert_rule_workflow,
        detector_workflow,
    )


def dual_write_alert_rule(alert_rule: AlertRule, user: RpcUser | None = None) -> None:
    """
    Comprehensively dual write the ACI objects corresponding to an alert rule, its triggers, and
    its actions. All these objects will have been created before calling this method.
    """
    with transaction.atomic(router.db_for_write(Detector)):
        # step 1: migrate the alert rule
        migrate_alert_rule(alert_rule, user)
        triggers = AlertRuleTrigger.objects.filter(alert_rule=alert_rule)
        # step 2: migrate each trigger
        for trigger in triggers:
            migrate_metric_data_conditions(trigger)
            trigger_actions = AlertRuleTriggerAction.objects.filter(alert_rule_trigger=trigger)
            # step 3: migrate this trigger's actions
            for trigger_action in trigger_actions:
                migrate_metric_action(trigger_action)
        # step 4: migrate alert rule resolution
        # if the alert rule is an anomaly detection alert, then this is handled by the anomaly detection data condition
        if alert_rule.detection_type != AlertRuleDetectionType.DYNAMIC:
            migrate_resolve_threshold_data_condition(alert_rule)
