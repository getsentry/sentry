import dataclasses
import logging
from typing import Any

from django.db import router, transaction
from django.forms import ValidationError

from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleThresholdType,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.integrations.opsgenie.client import OPSGENIE_DEFAULT_PRIORITY
from sentry.integrations.pagerduty.client import PAGERDUTY_DEFAULT_SEVERITY
from sentry.notifications.models.notificationaction import ActionService, ActionTarget
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.users.services.user import RpcUser
from sentry.workflow_engine.migration_helpers.utils import get_workflow_name
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
from sentry.workflow_engine.types import DetectorPriorityLevel
from sentry.workflow_engine.typings.notification_action import (
    OnCallDataBlob,
    SentryAppDataBlob,
    SentryAppIdentifier,
)

logger = logging.getLogger(__name__)

FIELDS_TO_DETECTOR_FIELDS = {
    "name": "name",
    "description": "description",
    "user_id": "owner_user_id",
    "team_id": "owner_team_id",
}

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

# XXX: "target_identifier" is not here because there is special logic to handle it
LEGACY_ACTION_FIELDS = ["integration_id", "target_display", "target_type"]


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
    base_config = {
        "target_display": target_display,
        "target_identifier": target_identifier,
        "target_type": target_type,
    }
    if target_type == ActionTarget.SENTRY_APP.value:
        base_config["sentry_app_identifier"] = SentryAppIdentifier.SENTRY_APP_ID
    return base_config


def get_detector_trigger(
    alert_rule_trigger: AlertRuleTrigger, priority: DetectorPriorityLevel
) -> DataCondition | None:
    """
    Helper method to find the detector trigger corresponding to an AlertRuleTrigger.
    Returns None if the detector cannot be found. Raises an exception if the detector
    exists but the detector trigger cannot be found.
    """
    alert_rule = alert_rule_trigger.alert_rule
    try:
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule_id=alert_rule.id)
    except AlertRuleDetector.DoesNotExist:
        # We attempted to dual delete a trigger that was not dual migrated
        logger.info(
            "alert rule was not dual written, returning early",
            extra={"alert_rule": alert_rule},
        )
        return None

    detector = alert_rule_detector.detector
    detector_data_condition_group = detector.workflow_condition_group
    if detector_data_condition_group is None:
        logger.error(
            "detector_data_condition_group does not exist",
            extra={"alert_rule_trigger_id": alert_rule_trigger.id},
        )
        raise MissingDataConditionGroup

    detector_trigger = DataCondition.objects.get(
        condition_group=detector_data_condition_group,
        condition_result=priority,
    )
    return detector_trigger


def get_action_filter(
    alert_rule_trigger: AlertRuleTrigger, priority: DetectorPriorityLevel
) -> DataCondition:
    """
    Helper method to find the action filter corresponding to an AlertRuleTrigger.
    Raises an exception if the action filter cannot be found.
    """
    alert_rule = alert_rule_trigger.alert_rule
    alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule_id=alert_rule.id)
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


def update_data_source_for_detector(alert_rule: AlertRule, detector: Detector) -> None:
    """
    Updates the Detector's DataSource to point to the AlertRule's current QuerySubscription.
    """
    snuba_query = alert_rule.snuba_query
    if not snuba_query:
        logger.error(
            "AlertRule has no SnubaQuery",
            extra={"alert_rule_id": alert_rule.id},
        )
        return

    current_subscription = (
        QuerySubscription.objects.filter(snuba_query=snuba_query.id)
        .exclude(status=QuerySubscription.Status.DELETING.value)
        .first()
    )
    if not current_subscription:
        logger.error(
            "No QuerySubscription found for AlertRule's SnubaQuery",
            extra={"alert_rule_id": alert_rule.id, "snuba_query_id": snuba_query.id},
        )
        return

    data_source = DataSource.objects.filter(
        detectors=detector,
        type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
    ).first()

    if not data_source:
        logger.warning(
            "No DataSource found for Detector",
            extra={"detector_id": detector.id, "alert_rule_id": alert_rule.id},
        )
        return

    new_source_id = str(current_subscription.id)
    if data_source.source_id == new_source_id:
        return

    old_source_id = data_source.source_id
    data_source.update(source_id=new_source_id)
    logger.info(
        "Updated DataSource to current QuerySubscription",
        extra={
            "data_source_id": data_source.id,
            "old_source_id": old_source_id,
            "new_source_id": new_source_id,
            "alert_rule_id": alert_rule.id,
        },
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
        owner_team=alert_rule.team,
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
        "owner_team": alert_rule.team,
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


def update_detector(
    alert_rule: AlertRule,
    detector: Detector,
) -> Detector:
    if detector.workflow_condition_group is None:
        raise MissingDataConditionGroup
    detector_field_values = get_detector_field_values(alert_rule, detector.workflow_condition_group)
    detector.update(**detector_field_values)
    return detector


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


def dual_update_alert_rule(alert_rule: AlertRule) -> None:
    """
    Comprehensively dual update the ACI objects corresponding to an alert rule, its triggers, and
    its actions. All of these objects will have been created/updated prior to calling this method.
    If an alert was not dual written, then quit early. If a trigger/trigger action on a dual written
    alert rule has no ACI equivalent, then create the corresponding ACI objects. Otherwise, update
    the corresponding ACI objects.
    """
    try:
        AlertRuleDetector.objects.get(alert_rule_id=alert_rule.id)
    except AlertRuleDetector.DoesNotExist:
        logger.info(
            "alert rule was not dual written, returning early",
            extra={"alert_rule": alert_rule},
        )
        # This alert rule was not dual written
        return None

    with transaction.atomic(router.db_for_write(Detector)):
        # step 1: update the alert rule
        dual_update_migrated_alert_rule(alert_rule)
        triggers = AlertRuleTrigger.objects.filter(alert_rule=alert_rule)
        # step 2: create/update the ACI objects for triggers
        for trigger in triggers:
            try:
                get_detector_trigger(trigger, PRIORITY_MAP[trigger.label])
            except DataCondition.DoesNotExist:
                # we need to migrate this trigger
                migrate_metric_data_conditions(trigger)
            dual_update_migrated_alert_rule_trigger(trigger)
            trigger_actions = AlertRuleTriggerAction.objects.filter(alert_rule_trigger=trigger)
            # step 3: create/update the ACI objects for this trigger's actions
            for trigger_action in trigger_actions:
                try:
                    ActionAlertRuleTriggerAction.objects.get(
                        alert_rule_trigger_action_id=trigger_action.id
                    )
                except ActionAlertRuleTriggerAction.DoesNotExist:
                    # we need to migrate this action
                    migrate_metric_action(trigger_action)
                dual_update_migrated_alert_rule_trigger_action(trigger_action)
        # step 4: update alert rule resolution
        dual_update_resolve_condition(alert_rule)


def dual_update_migrated_alert_rule(alert_rule: AlertRule) -> (
    tuple[
        DetectorState,
        Detector,
    ]
    | None
):
    alert_rule_detector = AlertRuleDetector.objects.get(alert_rule_id=alert_rule.id)
    detector: Detector = alert_rule_detector.detector
    detector_state = DetectorState.objects.get(detector=detector)

    update_detector(alert_rule, detector)

    # Sync the DataSource to ensure it points to a valid QuerySubscription
    update_data_source_for_detector(alert_rule, detector)

    data_condition_group = detector.workflow_condition_group
    if data_condition_group is None:
        # this shouldn't be possible due to the way we dual write
        logger.error(
            "AlertRuleDetector has no associated DataConditionGroup",
            extra={"alert_rule_id": alert_rule.id},
        )
        raise MissingDataConditionGroup
    data_conditions = DataCondition.objects.filter(condition_group=data_condition_group)

    # update the data condition types if the threshold type was updated

    threshold_type = (
        Condition.GREATER
        if alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value
        else Condition.LESS
    )
    resolve_threshold_type = (
        Condition.LESS_OR_EQUAL
        if alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value
        else Condition.GREATER_OR_EQUAL
    )
    for dc in data_conditions:
        if dc.condition_result == DetectorPriorityLevel.OK:
            dc.update(type=resolve_threshold_type)
        else:
            dc.update(type=threshold_type)

    # reset detector status, as the rule was updated
    detector_state.update(is_triggered=False, state=DetectorPriorityLevel.OK)

    return detector_state, detector


def dual_update_resolve_condition(alert_rule: AlertRule) -> DataCondition | None:
    """
    Helper method to update the detector trigger for a legacy resolution "trigger."
    """
    # if the alert rule hasn't been dual written, return early
    try:
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule_id=alert_rule.id)
    except AlertRuleDetector.DoesNotExist:
        # We attempted to dual delete a trigger that was not dual migrated
        return None

    detector = alert_rule_detector.detector
    detector_data_condition_group = detector.workflow_condition_group
    if detector_data_condition_group is None:
        logger.error(
            "detector_data_condition_group does not exist",
            extra={"alert_rule_id": alert_rule.id},
        )
        raise MissingDataConditionGroup

    data_conditions = DataCondition.objects.filter(condition_group=detector_data_condition_group)
    resolve_condition = data_conditions.filter(condition_result=DetectorPriorityLevel.OK).first()

    # changing detector priority level for anomaly detection alerts is handled by the data condition
    # so we should delete the explicit resolution condition if it exists
    if alert_rule.detection_type == AlertRuleDetectionType.DYNAMIC:
        if resolve_condition is not None:
            resolve_condition.delete()
        return None

    # if we're changing from anomaly detection alert to regular metric alert, we need to recreate the resolve condition
    if resolve_condition is None:
        resolve_condition = migrate_resolve_threshold_data_condition(alert_rule)
        return resolve_condition

    if alert_rule.resolve_threshold is not None:
        resolve_threshold = alert_rule.resolve_threshold
    else:
        resolve_threshold = get_resolve_threshold(detector_data_condition_group)
    if resolve_threshold == -1:
        raise UnresolvableResolveThreshold

    resolve_condition.update(comparison=resolve_threshold)

    return resolve_condition


def dual_update_migrated_alert_rule_trigger(
    alert_rule_trigger: AlertRuleTrigger,
) -> tuple[DataCondition, DataCondition] | None:
    priority = PRIORITY_MAP.get(alert_rule_trigger.label, DetectorPriorityLevel.HIGH)
    detector_trigger = get_detector_trigger(alert_rule_trigger, priority)
    if detector_trigger is None:
        # we will have already verified that that alert rule was dual written, so
        # we won't reach this path
        return None
    action_filter = get_action_filter(alert_rule_trigger, priority)
    resolve_action_filter = DataCondition.objects.filter(
        condition_group=action_filter.condition_group,
        type=Condition.ISSUE_PRIORITY_DEESCALATING,
    ).first()

    updated_detector_trigger_fields: dict[str, Any] = {}
    updated_action_filter_fields: dict[str, Any] = {}
    label = alert_rule_trigger.label
    updated_detector_trigger_fields["condition_result"] = PRIORITY_MAP.get(
        label, DetectorPriorityLevel.HIGH
    )
    updated_action_filter_fields["comparison"] = PRIORITY_MAP.get(label, DetectorPriorityLevel.HIGH)
    alert_rule = alert_rule_trigger.alert_rule

    # if we're changing to anomaly detection, we need to set the comparison JSON
    if alert_rule.detection_type == AlertRuleDetectionType.DYNAMIC:
        updated_detector_trigger_fields["type"] = Condition.ANOMALY_DETECTION
        updated_detector_trigger_fields["comparison"] = {
            "sensitivity": alert_rule.sensitivity,
            "seasonality": alert_rule.seasonality,
            "threshold_type": alert_rule.threshold_type,
        }
    else:
        updated_detector_trigger_fields["comparison"] = alert_rule_trigger.alert_threshold

    detector_trigger.update(**updated_detector_trigger_fields)
    if updated_action_filter_fields:
        # these are updated together
        action_filter.update(**updated_action_filter_fields)
        if resolve_action_filter is not None:
            resolve_action_filter.update(**updated_action_filter_fields)

    return detector_trigger, action_filter


def dual_update_migrated_alert_rule_trigger_action(
    trigger_action: AlertRuleTriggerAction,
) -> Action | None:
    aarta = ActionAlertRuleTriggerAction.objects.get(alert_rule_trigger_action_id=trigger_action.id)
    action = aarta.action

    action_type = get_action_type(trigger_action)
    if not action_type:
        logger.error(
            "Could not find a matching Action.Type for the trigger action",
            extra={"alert_rule_trigger_action_id": trigger_action.id},
        )
        raise ValidationError(
            f"Could not find a matching Action.Type for the trigger action {trigger_action.id}"
        )
    data = build_action_data_blob(trigger_action, action_type)
    target_identifier = get_target_identifier(trigger_action, action_type)
    action_config = build_action_config(
        trigger_action.target_display,
        target_identifier,
        trigger_action.target_type,
    )
    updated_action_fields: dict[str, Any] = {}
    updated_action_fields["type"] = Action.Type(action_type)
    updated_action_fields["data"] = data
    updated_action_fields["integration_id"] = trigger_action.integration_id
    updated_action_fields["config"] = action_config

    action.update(**updated_action_fields)
    return action


def get_data_source(alert_rule: AlertRule) -> DataSource | None:
    snuba_query = alert_rule.snuba_query
    organization = alert_rule.organization
    if not snuba_query or not organization:
        # This shouldn't be possible, but just in case.
        return None
    try:
        query_subscription = QuerySubscription.objects.get(snuba_query=snuba_query.id)
    except QuerySubscription.DoesNotExist:
        return None
    try:
        data_source = DataSource.objects.get(
            organization=organization,
            source_id=query_subscription.id,
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )
    except DataSource.DoesNotExist:
        return None
    return data_source


def dual_delete_migrated_alert_rule(alert_rule: AlertRule) -> None:
    try:
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule_id=alert_rule.id)
    except AlertRuleDetector.DoesNotExist:
        # NOTE: we run the dual delete even if the user isn't flagged into dual write
        logger.info(
            "alert rule was not dual written or objects were already deleted, returning early",
            extra={"alert_rule_id": alert_rule.id},
        )
        return

    detector: Detector = alert_rule_detector.detector
    alert_rule_workflow = None

    try:
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule_id=alert_rule.id)
    except AlertRuleWorkflow.DoesNotExist:
        logger.exception(
            "AlertRuleWorkflow not found for AlertRule, workflow may be orphaned",
            extra={"detector_id": detector.id},
        )
    if alert_rule_workflow:
        workflow: Workflow = alert_rule_workflow.workflow
        with transaction.atomic(router.db_for_write(Detector)):
            detector.update(status=ObjectStatus.PENDING_DELETION)
            workflow.update(status=ObjectStatus.PENDING_DELETION)
            RegionScheduledDeletion.schedule(instance=detector, days=0)
            RegionScheduledDeletion.schedule(instance=workflow, days=0)

    else:
        with transaction.atomic(router.db_for_write(Detector)):
            detector.update(status=ObjectStatus.PENDING_DELETION)
            RegionScheduledDeletion.schedule(instance=detector, days=0)

    return


def dual_delete_migrated_alert_rule_trigger(alert_rule_trigger: AlertRuleTrigger) -> None:
    priority = PRIORITY_MAP.get(alert_rule_trigger.label, DetectorPriorityLevel.HIGH)
    detector_trigger = get_detector_trigger(alert_rule_trigger, priority)
    if detector_trigger is None:
        logger.info(
            "alert rule was not dual written, returning early",
            extra={"alert_rule": alert_rule_trigger.alert_rule},
        )
        return None
    action_filter = get_action_filter(alert_rule_trigger, priority)
    action_filter_dcg = action_filter.condition_group
    # also dual delete the ACI objects for the trigger's associated trigger actions
    actions_to_dual_delete = AlertRuleTriggerAction.objects.filter(
        alert_rule_trigger_id=alert_rule_trigger.id
    )
    with transaction.atomic(router.db_for_write(DataCondition)):
        for trigger_action in actions_to_dual_delete:
            aarta = ActionAlertRuleTriggerAction.objects.get(
                alert_rule_trigger_action_id=trigger_action.id
            )
            action = aarta.action
            action.delete()

        detector_trigger.delete()
        action_filter_dcg.delete()  # deletes the action filter and resolve action filter

    return None


def dual_delete_migrated_alert_rule_trigger_action(trigger_action: AlertRuleTriggerAction) -> None:
    alert_rule_trigger = trigger_action.alert_rule_trigger
    # Check that we dual wrote this action
    priority = PRIORITY_MAP.get(alert_rule_trigger.label, DetectorPriorityLevel.HIGH)
    detector_trigger = get_detector_trigger(alert_rule_trigger, priority)
    if detector_trigger is None:
        logger.info(
            "alert rule was not dual written, returning early",
            extra={"alert_rule": alert_rule_trigger.alert_rule},
        )
        return None
    aarta = ActionAlertRuleTriggerAction.objects.get(alert_rule_trigger_action_id=trigger_action.id)
    with transaction.atomic(router.db_for_write(Action)):
        action = aarta.action
        action.delete()
    return None
