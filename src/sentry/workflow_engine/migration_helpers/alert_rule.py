import dataclasses
import logging
from typing import Any

from django.forms import ValidationError

from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleThresholdType,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.integrations.opsgenie.client import OPSGENIE_DEFAULT_PRIORITY
from sentry.integrations.pagerduty.client import PAGERDUTY_DEFAULT_SEVERITY
from sentry.notifications.models.notificationaction import ActionService
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.users.services.user import RpcUser
from sentry.workflow_engine.models import (
    Action,
    ActionAlertRuleTriggerAction,
    AlertRuleDetector,
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
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel
from sentry.workflow_engine.typings.notification_action import OnCallDataBlob, SentryAppDataBlob

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
        return {
            "type": alert_rule_trigger_action.type,
            "sentry_app_id": alert_rule_trigger_action.sentry_app_id,
            "sentry_app_config": alert_rule_trigger_action.sentry_app_config,
        }


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
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=alert_rule)
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
    alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=alert_rule)
    workflow = alert_rule_workflow.workflow
    workflow_dcgs = DataConditionGroup.objects.filter(workflowdataconditiongroup__workflow=workflow)
    action_filter = DataCondition.objects.get(
        condition_group__in=workflow_dcgs,
        comparison=priority,
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

    action = Action.objects.create(
        type=action_type_enum,
        data=data,
        integration_id=alert_rule_trigger_action.integration_id,
        target_display=alert_rule_trigger_action.target_display,
        target_identifier=target_identifier,
        target_type=alert_rule_trigger_action.target_type,
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
) -> tuple[DataCondition, DataCondition]:
    alert_rule = alert_rule_trigger.alert_rule
    # create a data condition for the Detector's data condition group with the
    # threshold and associated priority level
    alert_rule_detector = AlertRuleDetector.objects.select_related(
        "detector__workflow_condition_group"
    ).get(alert_rule=alert_rule)
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

    detector_trigger = DataCondition.objects.create(
        comparison=alert_rule_trigger.alert_threshold,
        condition_result=condition_result,
        type=threshold_type,
        condition_group=detector_data_condition_group,
    )

    # create an "action filter": if the detector's status matches a certain priority level,
    # then the condition result is set to true
    data_condition_group = DataConditionGroup.objects.create(
        organization_id=alert_rule.organization_id
    )
    alert_rule_workflow = AlertRuleWorkflow.objects.select_related("workflow").get(
        alert_rule=alert_rule
    )
    WorkflowDataConditionGroup.objects.create(
        condition_group=data_condition_group,
        workflow=alert_rule_workflow.workflow,
    )

    action_filter = DataCondition.objects.create(
        comparison=PRIORITY_MAP.get(alert_rule_trigger.label, DetectorPriorityLevel.HIGH),
        condition_result=True,
        type=Condition.ISSUE_PRIORITY_EQUALS,
        condition_group=data_condition_group,
    )
    return detector_trigger, action_filter


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


def migrate_resolve_threshold_data_conditions(
    alert_rule: AlertRule,
) -> tuple[DataCondition, DataCondition]:
    """
    Create data conditions for the old world's "resolve" threshold. If a resolve threshold
    has been explicitly set on the alert rule, then use this as our comparison value. Otherwise,
    we need to figure out what the resolve threshold is based on the trigger threshold values.
    """
    alert_rule_detector = AlertRuleDetector.objects.select_related(
        "detector__workflow_condition_group"
    ).get(alert_rule=alert_rule)
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

    data_condition_group = DataConditionGroup.objects.create(
        organization_id=alert_rule.organization_id
    )
    alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=alert_rule)
    WorkflowDataConditionGroup.objects.create(
        condition_group=data_condition_group,
        workflow=alert_rule_workflow.workflow,
    )

    action_filter = DataCondition.objects.create(
        comparison=DetectorPriorityLevel.OK,
        condition_result=True,
        type=Condition.ISSUE_PRIORITY_EQUALS,
        condition_group=data_condition_group,
    )
    return detector_trigger, action_filter


def create_metric_alert_lookup_tables(
    alert_rule: AlertRule,
    detector: Detector,
    workflow: Workflow,
) -> tuple[AlertRuleDetector, AlertRuleWorkflow, DetectorWorkflow]:
    alert_rule_detector = AlertRuleDetector.objects.create(alert_rule=alert_rule, detector=detector)
    alert_rule_workflow = AlertRuleWorkflow.objects.create(alert_rule=alert_rule, workflow=workflow)
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
        config={
            "threshold_period": alert_rule.threshold_period,
            "sensitivity": alert_rule.sensitivity,
            "seasonality": alert_rule.seasonality,
            "comparison_delta": alert_rule.comparison_delta,
            "detection_type": alert_rule.detection_type,
        },
    )


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

    workflow = create_workflow(alert_rule.name, organization_id, user)

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
        active=False,
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


def dual_update_migrated_alert_rule(alert_rule: AlertRule, updated_fields: dict[str, Any]) -> (
    tuple[
        DetectorState,
        Detector,
    ]
    | None
):
    try:
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=alert_rule)
    except AlertRuleDetector.DoesNotExist:
        logger.info(
            "alert rule was not dual written, returning early",
            extra={"alert_rule": alert_rule},
        )
        # This alert rule was not dual written
        return None

    detector: Detector = alert_rule_detector.detector

    detector_state = DetectorState.objects.get(detector=detector)

    updated_detector_fields: dict[str, Any] = {}
    config = detector.config.copy()

    for field, detector_field in FIELDS_TO_DETECTOR_FIELDS.items():
        if updated_field := updated_fields.get(field):
            updated_detector_fields[detector_field] = updated_field
    # update config fields
    config_fields = MetricAlertFire.detector_config_schema["properties"].keys()
    for field in config_fields:
        if field in updated_fields:
            config[field] = updated_fields[field]
    updated_detector_fields["config"] = config

    # if the user updated resolve_threshold or threshold_type, then we also need to update the detector triggers
    if "threshold_type" in updated_fields or "resolve_threshold" in updated_fields:
        data_condition_group = detector.workflow_condition_group
        if data_condition_group is None:
            # this shouldn't be possible due to the way we dual write
            logger.error(
                "AlertRuleDetector has no associated DataConditionGroup",
                extra={"alert_rule_id": alert_rule.id},
            )
            raise MissingDataConditionGroup
        data_conditions = DataCondition.objects.filter(condition_group=data_condition_group)
        if "threshold_type" in updated_fields:
            threshold_type = (
                Condition.GREATER
                if updated_fields["threshold_type"] == AlertRuleThresholdType.ABOVE.value
                else Condition.LESS
            )
            resolve_threshold_type = (
                Condition.LESS_OR_EQUAL
                if updated_fields["threshold_type"] == AlertRuleThresholdType.ABOVE.value
                else Condition.GREATER_OR_EQUAL
            )
            for dc in data_conditions:
                if dc.condition_result == DetectorPriorityLevel.OK:
                    dc.update(type=resolve_threshold_type)
                else:
                    dc.update(type=threshold_type)

        if "resolve_threshold" in updated_fields:
            resolve_condition = data_conditions.get(condition_result=DetectorPriorityLevel.OK)
            if updated_fields["resolve_threshold"] is None:
                # we need to figure out the resolve threshold ourselves
                resolve_threshold = get_resolve_threshold(data_condition_group)
                if resolve_threshold != -1:
                    resolve_condition.update(comparison=resolve_threshold)
                else:
                    raise UnresolvableResolveThreshold
            else:
                resolve_condition.update(comparison=updated_fields["resolve_threshold"])

    detector.update(**updated_detector_fields)

    # reset detector status, as the rule was updated
    detector_state.update(active=False, state=DetectorPriorityLevel.OK)

    return detector_state, detector


def dual_update_resolve_condition(alert_rule: AlertRule) -> DataCondition | None:
    """
    Helper method to update the detector trigger for a legacy resolution "trigger" if
    no explicit resolution threshold is set on the alert rule.
    """
    # if the alert rule has a resolve threshold or if it hasn't been dual written, return early
    if alert_rule.resolve_threshold is not None:
        return None
    try:
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=alert_rule)
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

    resolve_threshold = get_resolve_threshold(detector_data_condition_group)
    if resolve_threshold == -1:
        raise UnresolvableResolveThreshold

    data_conditions = DataCondition.objects.filter(condition_group=detector_data_condition_group)
    try:
        resolve_condition = data_conditions.get(condition_result=DetectorPriorityLevel.OK)
    except DataCondition.DoesNotExist:
        # In the serializer, we call handle triggers before migrating the resolve data condition,
        # so the resolve condition may not exist yet. Return early.
        return None
    resolve_condition.update(comparison=resolve_threshold)

    return resolve_condition


def dual_update_migrated_alert_rule_trigger(
    alert_rule_trigger: AlertRuleTrigger, updated_fields: dict[str, Any]
) -> tuple[DataCondition, DataCondition] | None:
    # NOTE: update the trigger *AFTER* calling this helper so that we can get the right data conditions
    priority = PRIORITY_MAP.get(alert_rule_trigger.label, DetectorPriorityLevel.HIGH)
    detector_trigger = get_detector_trigger(alert_rule_trigger, priority)
    if detector_trigger is None:
        logger.info(
            "alert rule was not dual written, returning early",
            extra={"alert_rule": alert_rule_trigger.alert_rule},
        )
        return None
    action_filter = get_action_filter(alert_rule_trigger, priority)

    # Fields have already been validated in logic.py, so we can update without validating here
    updated_detector_trigger_fields: dict[str, Any] = {}
    updated_action_filter_fields: dict[str, Any] = {}
    if "label" in updated_fields:
        label = updated_fields["label"]
        updated_detector_trigger_fields["condition_result"] = PRIORITY_MAP.get(
            label, DetectorPriorityLevel.HIGH
        )
        updated_action_filter_fields["comparison"] = PRIORITY_MAP.get(
            label, DetectorPriorityLevel.HIGH
        )
    if "alert_threshold" in updated_fields:
        updated_detector_trigger_fields["comparison"] = updated_fields["alert_threshold"]

    detector_trigger.update(**updated_detector_trigger_fields)
    if updated_action_filter_fields:
        action_filter.update(**updated_action_filter_fields)

    return detector_trigger, action_filter


def dual_update_migrated_alert_rule_trigger_action(
    trigger_action: AlertRuleTriggerAction, updated_fields: dict[str, Any]
) -> Action | None:
    # NOTE: update the action *BEFORE* calling this method so that we can reuse the get_action_type method
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
    aarta = ActionAlertRuleTriggerAction.objects.get(alert_rule_trigger_action=trigger_action)
    action = aarta.action

    updated_action_fields: dict[str, Any] = {}
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
    updated_action_fields["type"] = action_type
    updated_action_fields["data"] = data
    updated_action_fields["target_identifier"] = target_identifier

    for field in LEGACY_ACTION_FIELDS:
        if field in updated_fields:
            updated_action_fields[field] = updated_fields[field]

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


def dual_delete_migrated_alert_rule(
    alert_rule: AlertRule,
    user: RpcUser | None = None,
) -> None:
    try:
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=alert_rule)
    except AlertRuleDetector.DoesNotExist:
        # NOTE: we run the dual delete even if the user isn't flagged into dual write
        logger.info(
            "alert rule was not dual written or objects were already deleted, returning early",
            extra={"alert_rule_id": alert_rule.id},
        )
        return
    alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=alert_rule)

    workflow: Workflow = alert_rule_workflow.workflow
    detector: Detector = alert_rule_detector.detector
    data_condition_group: DataConditionGroup | None = detector.workflow_condition_group

    data_source = get_data_source(alert_rule=alert_rule)
    if data_source is None:
        logger.info(
            "DataSource does not exist",
            extra={"alert_rule_id": alert_rule.id},
        )

    triggers_to_dual_delete = AlertRuleTrigger.objects.filter(alert_rule=alert_rule)
    for trigger in triggers_to_dual_delete:
        dual_delete_migrated_alert_rule_trigger(trigger)

    if data_condition_group:
        # we need to delete the "resolve" dataconditions here as well
        data_conditions = DataCondition.objects.filter(condition_group=data_condition_group)
        resolve_detector_trigger = data_conditions.get(condition_result=DetectorPriorityLevel.OK)
        workflow_dcgs = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow=workflow
        )
        resolve_action_filter = DataCondition.objects.get(
            condition_group__in=workflow_dcgs,
            comparison=DetectorPriorityLevel.OK,
        )
        resolve_action_filter_dcg = resolve_action_filter.condition_group

        resolve_detector_trigger.delete()
        resolve_action_filter.delete()
        resolve_action_filter_dcg.delete()

    # NOTE: for migrated alert rules, each workflow is associated with a single detector
    # make sure there are no other detectors associated with the workflow, then delete it if so
    if DetectorWorkflow.objects.filter(workflow=workflow).count() == 1:
        # also deletes alert_rule_workflow
        workflow.delete()
    # also deletes alert_rule_detector, detector_workflow (if not already deleted), detector_state
    detector.delete()
    if data_condition_group:
        data_condition_group.delete()
    if data_source:
        data_source.delete()

    return


def dual_delete_migrated_alert_rule_trigger(
    alert_rule_trigger: AlertRuleTrigger,
    user: RpcUser | None = None,
) -> None:
    priority = PRIORITY_MAP.get(alert_rule_trigger.label, DetectorPriorityLevel.HIGH)
    detector_trigger = get_detector_trigger(alert_rule_trigger, priority)
    if detector_trigger is None:
        return None
    action_filter = get_action_filter(alert_rule_trigger, priority)
    action_filter_dcg = action_filter.condition_group
    # also dual delete the ACI objects for the trigger's associated trigger actions
    actions_to_dual_delete = AlertRuleTriggerAction.objects.filter(
        alert_rule_trigger=alert_rule_trigger
    )
    for trigger_action in actions_to_dual_delete:
        aarta = ActionAlertRuleTriggerAction.objects.get(alert_rule_trigger_action=trigger_action)
        action = aarta.action
        action.delete()

    detector_trigger.delete()
    action_filter.delete()
    action_filter_dcg.delete()

    return None


def dual_delete_migrated_alert_rule_trigger_action(
    trigger_action: AlertRuleTriggerAction,
    user: RpcUser | None = None,
) -> None:
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
    aarta = ActionAlertRuleTriggerAction.objects.get(alert_rule_trigger_action=trigger_action)
    action = aarta.action
    action.delete()
    return None
