import logging
from typing import Any

from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleThresholdType,
    AlertRuleTrigger,
    AlertRuleTriggerAction,
)
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.integrations.services.integration import integration_service
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


class MissingACITableException(Exception):
    pass


def get_action_type(alert_rule_trigger_action: AlertRuleTriggerAction) -> str | None:
    if alert_rule_trigger_action.sentry_app_id:
        return Action.Type.SENTRY_APP

    elif alert_rule_trigger_action.integration_id:
        integration = integration_service.get_integration(
            integration_id=alert_rule_trigger_action.integration_id
        )
        if not integration:
            return None
        try:
            return Action.Type(integration.provider)
        except Exception:
            return None
    else:
        return Action.Type.EMAIL


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
        return None

    detector = alert_rule_detector.detector
    detector_data_condition_group = detector.workflow_condition_group
    if detector_data_condition_group is None:
        logger.error(
            "detector_data_condition does not exist",
            extra={"alert_rule_trigger_id": alert_rule_trigger.id},
        )
        raise MissingACITableException

    try:
        detector_trigger = DataCondition.objects.get(
            condition_group=detector_data_condition_group,
            condition_result=priority,
        )
    except DataCondition.DoesNotExist:
        logger.exception(
            "detector trigger does not exist",
            extra={"alert_rule_trigger_id": alert_rule_trigger.id},
        )
        raise MissingACITableException
    return detector_trigger


def get_action_filter(
    alert_rule_trigger: AlertRuleTrigger, priority: DetectorPriorityLevel
) -> DataCondition:
    """
    Helper method to find the action filter corresponding to an AlertRuleTrigger.
    Raises an exception if the action filter cannot be found.
    """
    alert_rule = alert_rule_trigger.alert_rule
    try:
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=alert_rule)
    except AlertRuleWorkflow.DoesNotExist:
        logger.exception(
            "workflow does not exist",
            extra={"alert_rule_trigger_id": alert_rule_trigger.id},
        )
        raise MissingACITableException
    workflow = alert_rule_workflow.workflow
    workflow_dcgs = DataConditionGroup.objects.filter(workflowdataconditiongroup__workflow=workflow)
    try:
        action_filter = DataCondition.objects.get(
            condition_group__in=workflow_dcgs,
            comparison=priority,
        )
    except DataCondition.DoesNotExist:
        logger.exception(
            "action filter does not exist",
            extra={"alert_rule_trigger_id": alert_rule_trigger.id},
        )
        raise MissingACITableException
    return action_filter


def migrate_metric_action(
    alert_rule_trigger_action: AlertRuleTriggerAction,
) -> tuple[Action, DataConditionGroupAction, ActionAlertRuleTriggerAction] | None:
    alert_rule_trigger = alert_rule_trigger_action.alert_rule_trigger
    priority = PRIORITY_MAP[alert_rule_trigger.label]
    action_filter = get_action_filter(alert_rule_trigger, priority)

    action_type = get_action_type(alert_rule_trigger_action)
    if not action_type:
        logger.warning(
            "Could not find a matching Action.Type for the trigger action",
            extra={"alert_rule_trigger_action_id": alert_rule_trigger_action.id},
        )
        return None

    data = {
        "type": alert_rule_trigger_action.type,
        "sentry_app_id": alert_rule_trigger_action.sentry_app_id,
        "sentry_app_config": alert_rule_trigger_action.sentry_app_config,
    }
    action = Action.objects.create(
        required=False,
        type=action_type,
        data=data,
        integration_id=alert_rule_trigger_action.integration_id,
        target_display=alert_rule_trigger_action.target_display,
        target_identifier=alert_rule_trigger_action.target_identifier,
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
) -> tuple[DataCondition, DataCondition] | None:
    alert_rule = alert_rule_trigger.alert_rule
    # create a data condition for the Detector's data condition group with the
    # threshold and associated priority level
    alert_rule_detector = AlertRuleDetector.objects.select_related(
        "detector__workflow_condition_group"
    ).get(alert_rule=alert_rule)
    detector = alert_rule_detector.detector
    detector_data_condition_group = detector.workflow_condition_group
    if detector_data_condition_group is None:
        logger.error("workflow_condition_group does not exist", extra={"detector": detector})
        return None

    threshold_type = (
        Condition.GREATER
        if alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value
        else Condition.LESS
    )
    condition_result = (
        DetectorPriorityLevel.MEDIUM
        if alert_rule_trigger.label == "warning"
        else DetectorPriorityLevel.HIGH
    )

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
        comparison=(
            DetectorPriorityLevel.MEDIUM
            if alert_rule_trigger.label == "warning"
            else DetectorPriorityLevel.HIGH
        ),
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
    if detector_triggers.count() > 1:
        # there is a warning threshold for this detector, so we should resolve based on it
        warning_data_condition = detector_triggers.filter(
            condition_result=DetectorPriorityLevel.MEDIUM
        ).first()
        if warning_data_condition is None:
            logger.error(
                "more than one detector trigger in detector data condition group, but no warning condition exists",
                extra={"detector_data_condition_group": detector_triggers},
            )
            return -1
        resolve_threshold = warning_data_condition.comparison
    else:
        # critical threshold value
        critical_data_condition = detector_triggers.first()
        if critical_data_condition is None:
            logger.error(
                "no data conditions exist for detector data condition group",
                extra={"detector_data_condition_group": detector_triggers},
            )
            return -1
        resolve_threshold = critical_data_condition.comparison

    return resolve_threshold


def migrate_resolve_threshold_data_conditions(
    alert_rule: AlertRule,
) -> tuple[DataCondition, DataCondition] | None:
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
        return None

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
            return None

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
        query_id=query_subscription.id,
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

    detector_data_condition_group = create_data_condition_group(organization_id)
    detector = create_detector(alert_rule, project.id, detector_data_condition_group, user)

    workflow = create_workflow(alert_rule.name, organization_id, user)

    data_source.detectors.set([detector])
    detector_state = DetectorState.objects.create(
        detector=detector,
        active=False,
        state=DetectorPriorityLevel.OK,  # TODO this should be determined based on whether or not the rule has an active incident
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


def update_migrated_alert_rule(alert_rule: AlertRule, updated_fields: dict[str, Any]) -> (
    tuple[
        DetectorState,
        Detector,
    ]
    | None
):
    try:
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=alert_rule)
    except AlertRuleDetector.DoesNotExist:
        logger.exception(
            "AlertRuleDetector does not exist",
            extra={"alert_rule_id": alert_rule.id},
        )
        return None

    detector: Detector = alert_rule_detector.detector

    try:
        detector_state = DetectorState.objects.get(detector=detector)
    except DetectorState.DoesNotExist:
        logger.exception(
            "DetectorState does not exist",
            extra={"alert_rule_id": alert_rule.id, "detector_id": detector.id},
        )
        return None

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
            return None
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
            resolve_condition = data_conditions.filter(condition_result=DetectorPriorityLevel.OK)
            resolve_condition.update(comparison=updated_fields["resolve_threshold"])

    detector.update(**updated_detector_fields)

    # reset detector status, as the rule was updated
    detector_state.update(active=False, state=DetectorPriorityLevel.OK)

    return detector_state, detector


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
            query_id=query_subscription.id,
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
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=alert_rule)
    except AlertRuleDetector.DoesNotExist:
        # NOTE: making this an info log because we run the dual delete even if the user
        # isn't flagged into dual write
        logger.info(
            "AlertRuleDetector does not exist",
            extra={"alert_rule_id": alert_rule.id},
        )
        return
    except AlertRuleWorkflow.DoesNotExist:
        logger.info(
            "AlertRuleWorkflow does not exist",
            extra={"alert_rule_id": alert_rule.id},
        )
        return

    workflow: Workflow = alert_rule_workflow.workflow
    detector: Detector = alert_rule_detector.detector
    data_condition_group: DataConditionGroup | None = detector.workflow_condition_group

    data_source = get_data_source(alert_rule=alert_rule)
    if data_source is None:
        logger.info(
            "DataSource does not exist",
            extra={"alert_rule_id": alert_rule.id},
        )
    # NOTE: for migrated alert rules, each workflow is associated with a single detector
    # make sure there are no other detectors associated with the workflow, then delete it if so
    if DetectorWorkflow.objects.filter(workflow=workflow).count() == 1:
        # also deletes alert_rule_workflow
        RegionScheduledDeletion.schedule(instance=workflow, days=0, actor=user)
    # also deletes alert_rule_detector, detector_workflow (if not already deleted), detector_state
    RegionScheduledDeletion.schedule(instance=detector, days=0, actor=user)
    if data_condition_group:
        RegionScheduledDeletion.schedule(instance=data_condition_group, days=0, actor=user)
    if data_source:
        RegionScheduledDeletion.schedule(instance=data_source, days=0, actor=user)

    return


def dual_delete_migrated_alert_rule_trigger(
    alert_rule_trigger: AlertRuleTrigger,
    user: RpcUser | None = None,
) -> None:
    priority = PRIORITY_MAP[alert_rule_trigger.label]
    detector_trigger = get_detector_trigger(alert_rule_trigger, priority)
    if detector_trigger is None:
        return None
    action_filter = get_action_filter(alert_rule_trigger, priority)

    detector_trigger.delete()
    action_filter.delete()

    return None


def dual_delete_migrated_alert_rule_trigger_action(
    trigger_action: AlertRuleTriggerAction,
    user: RpcUser | None = None,
) -> None:
    alert_rule_trigger = trigger_action.alert_rule_trigger
    # Check that we dual wrote this action
    priority = PRIORITY_MAP[alert_rule_trigger.label]
    detector_trigger = get_detector_trigger(alert_rule_trigger, priority)
    if detector_trigger is None:
        return None
    try:
        aarta = ActionAlertRuleTriggerAction.objects.get(alert_rule_trigger_action=trigger_action)
    except ActionAlertRuleTriggerAction.DoesNotExist:
        logger.exception(
            "ActionAlertRuleTriggerAction does not exist",
            extra={"alert_rule_trigger_action_id": trigger_action.id},
        )
        raise MissingACITableException
    action = aarta.action
    action.delete()
    return None
