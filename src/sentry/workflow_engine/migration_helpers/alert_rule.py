import logging

from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.incidents.grouptype import MetricAlertFire
from sentry.incidents.models.alert_rule import AlertRule
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
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
)
from sentry.workflow_engine.types import DetectorPriorityLevel

logger = logging.getLogger(__name__)


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
        state=DetectorPriorityLevel.OK,
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
        logger.error(
            "DataSource does not exist",
            extra={"alert_rule_id": AlertRule.id},
        )
        return
    # NOTE: for migrated alert rules, each workflow is associated with a single detector
    # make sure there are no other detectors associated with the workflow, then delete it if so
    if DetectorWorkflow.objects.filter(workflow=workflow).count() == 1:
        # also deletes alert_rule_workflow
        RegionScheduledDeletion.schedule(instance=workflow, days=0, actor=user)
    # also deletes alert_rule_detector, detector_workflow (if not already deleted), detector_state
    RegionScheduledDeletion.schedule(instance=detector, days=0, actor=user)
    if data_condition_group:
        RegionScheduledDeletion.schedule(instance=data_condition_group, days=0, actor=user)
    RegionScheduledDeletion.schedule(instance=data_source, days=0, actor=user)

    return
