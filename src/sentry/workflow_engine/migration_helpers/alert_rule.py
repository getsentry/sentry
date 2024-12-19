# NOTE: will have to rebase and add these changes to the file created by Colleen once her changes land
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.incidents.models.alert_rule import AlertRule
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.snuba.models import QuerySubscription
from sentry.users.services.user import RpcUser
from sentry.workflow_engine.models import AlertRuleDetector, DataSource, Detector


def get_data_source(alert_rule: AlertRule) -> DataSource | None:
    # TODO: if dual deleting, then we should delete the subscriptions here and not in logic.py
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
    except AlertRuleDetector.DoesNotExist:
        # TODO: log failure
        return

    detector: Detector = alert_rule_detector.detector
    data_condition_group = detector.workflow_condition_group

    data_source = get_data_source(alert_rule=alert_rule)
    if data_source is None:
        # TODO: log failure
        return

    # also deletes alert_rule_workflow
    RegionScheduledDeletion.schedule(instance=alert_rule, days=0, actor=user)
    RegionScheduledDeletion.schedule(instance=data_source, days=0, actor=user)
    # also deletes alert_rule_detector, detector_workflow, detector_state
    RegionScheduledDeletion.schedule(instance=detector, days=0, actor=user)
    # also deletes workflow_data_condition_group
    RegionScheduledDeletion.schedule(instance=data_condition_group, days=0, actor=user)

    # What is the equivalent of SNAPSHOT in the new world?
    return
