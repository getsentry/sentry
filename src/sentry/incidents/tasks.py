from __future__ import annotations

import logging
from typing import Any

from sentry.incidents.models.alert_rule import (
    AlertRuleStatus,
    AlertRuleTriggerAction,
    AlertRuleTriggerActionMethod,
)
from sentry.incidents.models.incident import (
    Incident,
    IncidentActivity,
    IncidentStatus,
    IncidentStatusMethod,
)
from sentry.incidents.utils.constants import (
    INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
    SUBSCRIPTION_METRICS_LOGGER,
)
from sentry.incidents.utils.types import QuerySubscriptionUpdate
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription
from sentry.snuba.query_subscriptions.consumer import register_subscriber
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@register_subscriber(SUBSCRIPTION_METRICS_LOGGER)
def handle_subscription_metrics_logger(
    subscription_update: QuerySubscriptionUpdate, subscription: QuerySubscription
) -> None:
    """
    Logs results from a `QuerySubscription`.
    """
    from sentry.incidents.subscription_processor import SubscriptionProcessor

    try:
        if subscription.snuba_query.dataset == Dataset.Metrics.value:
            processor = SubscriptionProcessor(subscription)
            # XXX: Temporary hack so that we can extract these values without raising an exception
            processor.reset_trigger_counts = lambda *arg, **kwargs: None  # type: ignore[method-assign]
            aggregation_value = processor.get_aggregation_value(subscription_update)

            logger.info(
                "handle_subscription_metrics_logger.message",
                extra={
                    "subscription_id": subscription.id,
                    "dataset": subscription.snuba_query.dataset,
                    "snuba_subscription_id": subscription.subscription_id,
                    "result": subscription_update,
                    "aggregation_value": aggregation_value,
                },
            )
    except Exception:
        logger.exception("Failed to log subscription results")


@register_subscriber(INCIDENTS_SNUBA_SUBSCRIPTION_TYPE)
def handle_snuba_query_update(
    subscription_update: QuerySubscriptionUpdate, subscription: QuerySubscription
) -> None:
    """
    Handles a subscription update for a `QuerySubscription`.
    """
    from sentry.incidents.subscription_processor import SubscriptionProcessor

    # noinspection SpellCheckingInspection
    with metrics.timer("incidents.subscription_procesor.process_update"):
        SubscriptionProcessor(subscription).process_update(subscription_update)


@instrumented_task(
    name="sentry.incidents.tasks.handle_trigger_action",
    queue="incidents",
    default_retry_delay=60,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
def handle_trigger_action(
    action_id: int,
    incident_id: int,
    project_id: int,
    method: AlertRuleTriggerActionMethod,
    new_status: int,
    metric_value: int | None = None,
    **kwargs: Any,
) -> None:
    try:
        action = AlertRuleTriggerAction.objects.select_related(
            "alert_rule_trigger", "alert_rule_trigger__alert_rule"
        ).get(id=action_id)
    except AlertRuleTriggerAction.DoesNotExist:
        metrics.incr("incidents.alert_rules.action.skipping_missing_action")
        return

    try:
        incident = Incident.objects.select_related("organization").get(id=incident_id)
    except Incident.DoesNotExist:
        metrics.incr("incidents.alert_rules.action.skipping_missing_incident")
        return

    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        metrics.incr("incidents.alert_rules.action.skipping_missing_project")
        return

    incident_activity = (
        IncidentActivity.objects.filter(incident=incident, value=new_status).order_by("-id").first()
    )
    notification_uuid = str(incident_activity.notification_uuid) if incident_activity else None
    if notification_uuid is None:
        metrics.incr("incidents.alert_rules.action.incident_activity_missing")

    metrics.incr(
        "incidents.alert_rules.action.{}.{}".format(
            AlertRuleTriggerAction.Type(action.type).name.lower(), method
        )
    )

    getattr(action, method)(
        action,
        incident,
        project,
        metric_value=metric_value,
        new_status=IncidentStatus(new_status),
        notification_uuid=notification_uuid,
    )


@instrumented_task(
    name="sentry.incidents.tasks.auto_resolve_snapshot_incidents",
    queue="incidents",
    default_retry_delay=60,
    max_retries=2,
    silo_mode=SiloMode.REGION,
)
def auto_resolve_snapshot_incidents(alert_rule_id: int, **kwargs: Any) -> None:
    from sentry.incidents.logic import update_incident_status
    from sentry.incidents.models.alert_rule import AlertRule

    try:
        alert_rule = AlertRule.objects_with_snapshots.get(id=alert_rule_id)
    except AlertRule.DoesNotExist:
        return

    if alert_rule.status != AlertRuleStatus.SNAPSHOT.value:
        return

    batch_size = 50
    incidents = Incident.objects.filter(alert_rule=alert_rule).exclude(
        status=IncidentStatus.CLOSED.value
    )[: batch_size + 1]
    has_more = incidents.count() > batch_size
    if incidents:
        incidents = incidents[:batch_size]
        for incident in incidents:
            update_incident_status(
                incident,
                IncidentStatus.CLOSED,
                status_method=IncidentStatusMethod.RULE_UPDATED,
            )

    if has_more:
        auto_resolve_snapshot_incidents.apply_async(
            kwargs={"alert_rule_id": alert_rule_id}, countdown=1
        )
