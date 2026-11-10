from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Any, TypedDict

from taskbroker_client.retry import Retry

from sentry import features
from sentry.api.serializers import serialize
from sentry.models.group import Group
from sentry.sentry_apps.event_types import SentryAppEventType
from sentry.sentry_apps.tasks.sentry_apps import (
    WebhookGroupResponse,
    _is_project_allowed,
    _webhook_issue_data,
    installations_subscribed_to,
    send_resource_change_webhook,
)
from sentry.services.eventstore.models import GroupEvent
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import sentryapp_tasks
from sentry.utils import json
from sentry.workflow_engine.models import Workflow, WorkflowFireHistory
from sentry.workflow_engine.types import WorkflowEventData

logger = logging.getLogger(__name__)

FEATURE_FLAG = "organizations:sentry-app-alert-webhooks"


class AlertFire(TypedDict):
    workflow_id: int
    notification_uuid: str
    fired_at: str


class AlertData(TypedDict):
    id: int
    title: str
    environment: str | None
    url: str
    web_url: str


class AlertTriggeredWebhookPayload(TypedDict):
    alert: AlertData
    issue: WebhookGroupResponse
    event_id: str | None
    notification_uuid: str
    fired_at: str


def enqueue_alert_triggered_webhooks(
    fire_histories: Sequence[WorkflowFireHistory], event_data: WorkflowEventData
) -> None:
    """
    Queue `alert.triggered` webhooks for the workflows that just fired.

    This runs inline with workflow processing, so it only does cached lookups
    and leaves payload building to the task.
    """
    if not fire_histories:
        return

    try:
        organization = event_data.group.project.organization
        if not features.has(FEATURE_FLAG, organization):
            return
        if not installations_subscribed_to(organization.id, SentryAppEventType.ALERT_TRIGGERED):
            return

        send_alert_triggered_webhooks.delay(
            organization_id=organization.id,
            group_id=event_data.group.id,
            event_id=(
                event_data.event.event_id if isinstance(event_data.event, GroupEvent) else None
            ),
            fires=[
                AlertFire(
                    workflow_id=history.workflow_id,
                    notification_uuid=str(history.notification_uuid),
                    fired_at=history.date_added.isoformat(),
                )
                for history in fire_histories
            ],
        )
    except Exception:
        # A webhook problem must never stop the alert's own actions from firing.
        logger.exception(
            "workflow_engine.alert_webhooks.enqueue_failed",
            extra={"group_id": event_data.group.id},
        )


@instrumented_task(
    name="sentry.workflow_engine.tasks.alert_webhooks.send_alert_triggered_webhooks",
    namespace=sentryapp_tasks,
    retry=Retry(times=3, delay=60 * 5),
    processing_deadline_duration=30,
    silo_mode=SiloMode.CELL,
)
def send_alert_triggered_webhooks(
    *,
    organization_id: int,
    group_id: int,
    event_id: str | None,
    fires: list[AlertFire],
    **kwargs: Any,
) -> None:
    event_type = SentryAppEventType.ALERT_TRIGGERED
    try:
        group = Group.objects.select_related("project__organization").get(
            id=group_id, project__organization_id=organization_id
        )
    except Group.DoesNotExist:
        return

    installations = [
        installation
        for installation in installations_subscribed_to(organization_id, event_type)
        if _is_project_allowed(installation, group.project_id)
    ]
    if not installations:
        return

    workflows = {
        workflow.id: workflow
        for workflow in Workflow.objects.filter(
            id__in=[fire["workflow_id"] for fire in fires],
            organization_id=organization_id,
            type=Workflow.Type.ALERT,
        ).select_related("environment")
    }
    if not workflows:
        return

    organization = group.project.organization
    # Task arguments must be JSON-safe, and the serialized group holds datetimes.
    issue = json.loads(json.dumps(_webhook_issue_data(group, serialize(group))))

    for fire in fires:
        workflow = workflows.get(fire["workflow_id"])
        if workflow is None:
            continue

        payload = AlertTriggeredWebhookPayload(
            alert=AlertData(
                id=workflow.id,
                title=workflow.name,
                environment=workflow.environment.name if workflow.environment else None,
                url=organization.absolute_api_url(f"workflows/{workflow.id}/"),
                web_url=organization.absolute_url(
                    f"organizations/{organization.slug}/monitors/alerts/{workflow.id}/"
                ),
            ),
            issue=issue,
            event_id=event_id,
            notification_uuid=fire["notification_uuid"],
            fired_at=fire["fired_at"],
        )
        for installation in installations:
            send_resource_change_webhook.delay(installation.id, event_type, dict(payload))
