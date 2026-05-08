from __future__ import annotations

import logging
from typing import Any

from django.db import router, transaction
from taskbroker_client.retry import Retry

from sentry.incidents.models.alert_rule import AlertRuleStatus
from sentry.incidents.models.incident import (
    Incident,
    IncidentStatus,
    IncidentStatusMethod,
)
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import QuerySubscriptionUpdate
from sentry.silo.base import SiloMode
from sentry.snuba.models import QuerySubscription
from sentry.snuba.query_subscriptions.consumer import register_subscriber
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import alerts_tasks
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
    silo_mode=SiloMode.CELL,
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
    pass


@instrumented_task(
    name="sentry.incidents.tasks.auto_resolve_snapshot_incidents",
    namespace=alerts_tasks,
    retry=Retry(times=2, delay=60),
    silo_mode=SiloMode.CELL,
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
    incidents = list(
        Incident.objects.filter(alert_rule=alert_rule).exclude(status=IncidentStatus.CLOSED.value)[
            : batch_size + 1
        ]
    )
    has_more = len(incidents) > batch_size
    if incidents:
        with transaction.atomic(router.db_for_write(Incident)):
            for incident in incidents[:batch_size]:
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
