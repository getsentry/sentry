from __future__ import annotations

import logging
from typing import Any

from django.db import router, transaction

from sentry.incidents.models.alert_rule import AlertRuleStatus, AlertRuleTriggerAction
from sentry.incidents.models.incident import (
    Incident,
    IncidentActivity,
    IncidentStatus,
    IncidentStatusMethod,
)
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import QuerySubscriptionUpdate
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.snuba.models import QuerySubscription
from sentry.snuba.query_subscriptions.consumer import register_subscriber
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import alerts_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import metrics

logger = logging.getLogger(__name__)


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
        SubscriptionProcessor.process(subscription, subscription_update)


@instrumented_task(
    name="sentry.incidents.tasks.handle_trigger_action",
    namespace=alerts_tasks,
    retry=Retry(times=5, delay=60),
    processing_deadline_duration=60,
    silo_mode=SiloMode.REGION,
)
def handle_trigger_action(
    action_id: int,
    incident_id: int,
    project_id: int,
    method: str,
    new_status: int,
    metric_value: float | int | None = None,
    **kwargs: Any,
) -> None:
    from sentry.incidents.grouptype import MetricIssue
    from sentry.notifications.notification_action.utils import should_fire_workflow_actions

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

    # We should only fire using the legacy registry if we are not using the workflow engine
    if not should_fire_workflow_actions(incident.organization, MetricIssue.type_id):
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
    namespace=alerts_tasks,
    retry=Retry(times=2, delay=60),
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
        with transaction.atomic(router.db_for_write(Incident)):
            for incident in incidents:
                update_incident_status(
                    incident,
                    IncidentStatus.CLOSED,
                    status_method=IncidentStatusMethod.RULE_UPDATED,
                )

            if has_more:
                transaction.on_commit(
                    lambda: auto_resolve_snapshot_incidents.apply_async(
                        kwargs={"alert_rule_id": alert_rule_id}
                    ),
                    using=router.db_for_write(Incident),
                )
