# NOTE: will have to rebase and add these changes to the file created by Colleen once her changes land
from sentry.incidents.models.alert_rule import AlertRule
from sentry.snuba.models import QuerySubscription
from sentry.users.services.user import RpcUser
from sentry.workflow_engine.models import (
    AlertRuleDetector,
    AlertRuleWorkflow,
    DataSource,
    Detector,
    DetectorState,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)


def get_alert_rule_lookup_tables(
    alert_rule: AlertRule,
) -> tuple[AlertRuleDetector, AlertRuleWorkflow] | None:
    try:
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=alert_rule)
        alert_rule_workflow = AlertRuleWorkflow.objects.get(alert_rule=alert_rule)
    except (AlertRuleDetector.DoesNotExist, AlertRuleWorkflow.DoesNotExist):
        return None
    return (alert_rule_detector, alert_rule_workflow)


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
            type="snuba_query_subscription",  # TODO: rebase and use the constant
        )
    except DataSource.DoesNotExist:
        return None
    return data_source


def dual_delete_migrated_alert_rule(
    alert_rule: AlertRule,
    user: RpcUser | None = None,
) -> None:
    # Step one: get the lookup tables corresponding to the alert rule
    alert_rule_lookup_tables = get_alert_rule_lookup_tables(alert_rule=alert_rule)
    if alert_rule_lookup_tables is None:
        # TODO: log failure
        return
    alert_rule_detector, alert_rule_workflow = alert_rule_lookup_tables
    # Step two: get DCG, workflow, detector, detector state, data source using the lookup tables
    detector: Detector = alert_rule_detector.detector
    workflow: Workflow = alert_rule_workflow.workflow
    data_condition_group = detector.workflow_condition_group

    data_source = get_data_source(alert_rule=alert_rule)
    if data_source is None:
        # TODO: log failure
        return
    try:
        detector_state = DetectorState.objects.get(detector=detector)
        detector_workflow = DetectorWorkflow.objects.get(detector=detector, workflow=workflow)
        workflow_data_condition_group = WorkflowDataConditionGroup.objects.get(
            workflow=workflow, data_condition_group=data_condition_group
        )
    except (
        DetectorState.DoesNotExist,
        DetectorWorkflow.DoesNotExist,
        WorkflowDataConditionGroup.DoesNotExist,
    ):
        # TODO: log failure
        return

    # Step three: schedule everything for deletion
    # What is the equivalent of SNAPSHOT in the new world?
    pass
