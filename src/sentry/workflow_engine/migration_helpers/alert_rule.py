from typing import Any
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


def migrate_metric_data_condition(
    alert_rule_trigger: AlertRuleTrigger,
) -> tuple[DataCondition, AlertRuleTriggerDataCondition] | None:
    alert_rule = alert_rule_trigger.alert_rule

    data_condition_group = DataConditionGroup.objects.create(
        organization_id=alert_rule.organization_id
    )
    alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=alert_rule)
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
    return data_condition, alert_rule_trigger_data_condition


def migrate_resolve_threshold_data_condition(alert_rule: AlertRule) -> DataCondition:
    """
    Create data conditions for rules with a resolve threshold
    """
    data_condition_group = DataConditionGroup.objects.create(
        organization_id=alert_rule.organization_id
    )
    alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=alert_rule)
    WorkflowDataConditionGroup.objects.create(
        condition_group=data_condition_group,
        workflow=alert_rule_workflow.workflow,
    )
    threshold_type = (
        Condition.LESS
        if alert_rule.threshold_type == AlertRuleThresholdType.ABOVE.value
        else Condition.GREATER
    )
    # XXX: we set the resolve trigger's threshold_type to whatever the opposite of the rule's threshold_type is
    # e.g. if the rule has a critical trigger ABOVE some number, the resolve threshold is automatically set to BELOW

    data_condition = DataCondition.objects.create(
        comparison=alert_rule.resolve_threshold,
        condition_result=DetectorPriorityLevel.OK,
        type=threshold_type,
        condition_group=data_condition_group,
    )
    # XXX: can't make an AlertRuleTriggerDataCondition since this isn't really a trigger
    return data_condition


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

    detector: Detector = alert_rule_detector.detector

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

    # if the user updated resolve_threshold or threshold_type, then we also need to update the Detector's DataConditions
    """
    type:
    - get all data conditions associated with the alert rule
    - for each data condition, update the threshold type

    resolve threshold:
    - figure out which data condition maps to resolve (how?)
    - we can get to detector DCG and then look for condition result OK
    - update the comparison field
    """
    if "threshold_type" in updated_fields or "resolve_threshold" in updated_fields:
        data_condition_group = detector.workflow_condition_group
        if data_condition_group is None:
            # this shouldn't be possible due to the way we dual write
            # logger.error(
            #     "AlertRuleDetector has no associated DataConditionGroup",
            #     extra={"alert_rule_id": AlertRule.id},
            # )
            return None
        data_conditions = DataCondition.objects.filter(condition_group=data_condition_group)
        if "threshold_type" in updated_fields:
            for dc in data_conditions:
                dc.update(**{"type": updated_fields["threshold_type"]})
        if "resolve_threshold" in updated_fields:
            # we must have this, I think
            resolve_condition = data_conditions.filter(condition_result=DetectorPriorityLevel.OK)
            resolve_condition.update(**{"comparison": updated_fields["resolve_threshold"]})

    detector.update(**updated_detector_fields)

    # reset detector status, as the rule was updated
    updated_status = {
        "active": False,
        "state": DetectorPriorityLevel.OK,
    }
    detector_state.update(**updated_status)

    # TODO: do we need to create an audit log entry here?
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
