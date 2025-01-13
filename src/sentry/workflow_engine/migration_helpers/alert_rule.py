import logging

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
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel

logger = logging.getLogger(__name__)


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


def migrate_metric_action(
    alert_rule_trigger_action: AlertRuleTriggerAction,
) -> tuple[Action, DataConditionGroupAction] | None:
    try:
        alert_rule_trigger_data_condition = AlertRuleTriggerDataCondition.objects.get(
            alert_rule_trigger=alert_rule_trigger_action.alert_rule_trigger
        )
    except AlertRuleTriggerDataCondition.DoesNotExist:
        logger.exception(
            "AlertRuleTriggerDataCondition does not exist",
            extra={"alert_rule_trigger_id": alert_rule_trigger_action.alert_rule_trigger.id},
        )
        return None

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
        condition_group_id=alert_rule_trigger_data_condition.data_condition.condition_group.id,
        action_id=action.id,
    )
    return action, data_condition_group_action


def migrate_metric_data_conditions(
    alert_rule_trigger: AlertRuleTrigger,
) -> tuple[DataCondition, DataCondition, AlertRuleTriggerDataCondition] | None:
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

    detector_trigger = DataCondition.objects.create(
        comparison=alert_rule_trigger.alert_threshold,
        condition_result=(
            DetectorPriorityLevel.MEDIUM
            if alert_rule_trigger.label == "warning"
            else DetectorPriorityLevel.HIGH
        ),
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
    data_condition = DataCondition.objects.create(
        comparison=(
            DetectorPriorityLevel.MEDIUM
            if alert_rule_trigger.label == "warning"
            else DetectorPriorityLevel.HIGH
        ),
        condition_result=True,
        type=Condition.ISSUE_PRIORITY_EQUALS,
        condition_group=data_condition_group,
    )
    alert_rule_trigger_data_condition = AlertRuleTriggerDataCondition.objects.create(
        alert_rule_trigger=alert_rule_trigger, data_condition=data_condition
    )
    return detector_trigger, data_condition, alert_rule_trigger_data_condition


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

    data_condition = DataCondition.objects.create(
        comparison=DetectorPriorityLevel.OK,
        condition_result=True,
        type=Condition.ISSUE_PRIORITY_EQUALS,
        condition_group=data_condition_group,
    )
    # XXX: can't make an AlertRuleTriggerDataCondition since this isn't really a trigger
    return detector_trigger, data_condition


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
            extra={"alert_rule_id": AlertRule.id},
        )
        return
    except AlertRuleWorkflow.DoesNotExist:
        logger.info(
            "AlertRuleWorkflow does not exist",
            extra={"alert_rule_id": AlertRule.id},
        )
        return

    workflow: Workflow = alert_rule_workflow.workflow
    detector: Detector = alert_rule_detector.detector
    data_condition_group: DataConditionGroup | None = detector.workflow_condition_group

    data_source = get_data_source(alert_rule=alert_rule)
    if data_source is None:
        logger.info(
            "DataSource does not exist",
            extra={"alert_rule_id": AlertRule.id},
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
    trigger: AlertRuleTrigger,
    user: RpcUser | None = None,
) -> None:
    # get the detector trigger that corresponds to this AlertRuleTrigger (how?)
    # get the data condition that corresponds to this AlertRuleTrigger using the table
    # are we going to have orphaned resolve conditions?
    pass


def dual_delete_migrated_alert_rule_trigger_action(
    action: AlertRuleTriggerAction,
    user: RpcUser | None = None,
) -> None:
    # how do we get the corresponding action lol
    pass
