from __future__ import annotations

import sentry_sdk

from sentry import features
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.typings.metric_detector import MetricIssueContext
from sentry.integrations.slack.message_builder.incidents import SlackIncidentsMessageBuilder
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.notifications.notification_action.metric_alert_registry.handlers.utils import (
    get_alert_rule_serializer,
    get_detector_serializer,
)
from sentry.notifications.notification_action.types import BaseMetricAlertHandler
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.templates.metric_alert import (
    ActivityMetricAlertNotificationData,
    BaseMetricAlertNotificationData,
    MetricAlertNotificationData,
)
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
)
from sentry.services import eventstore
from sentry.services.eventstore.models import GroupEvent
from sentry.workflow_engine.models.detector import Detector


def _build_metric_issue_context_from_group_event(
    data: MetricAlertNotificationData,
) -> MetricIssueContext:
    event = eventstore.backend.get_event_by_id(
        data.project_id, data.event_id, group_id=data.group_id
    )
    if event is None:
        raise ValueError(f"Event {data.event_id} not found")
    elif not isinstance(event, GroupEvent):
        raise ValueError(f"Event {data.event_id} is not a GroupEvent")

    evidence_data, priority = BaseMetricAlertHandler._extract_from_group_event(event)
    return MetricIssueContext.from_group_event(event.group, evidence_data, priority)


def _build_metric_issue_context_from_activity(
    data: ActivityMetricAlertNotificationData,
) -> MetricIssueContext:
    from sentry.models.activity import Activity

    activity = Activity.objects.get(id=data.activity_id)
    group = Group.objects.get_from_cache(id=data.group_id)
    evidence_data, priority = BaseMetricAlertHandler._extract_from_activity(activity)
    return MetricIssueContext.from_group_event(group, evidence_data, priority)


class SlackMetricAlertRenderer(NotificationRenderer[SlackRenderable]):
    provider_key = NotificationProviderKey.SLACK

    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        if not isinstance(data, BaseMetricAlertNotificationData):
            raise ValueError(f"SlackMetricAlertRenderer does not support {data.__class__.__name__}")

        if isinstance(data, MetricAlertNotificationData):
            metric_issue_context = _build_metric_issue_context_from_group_event(data)
        elif isinstance(data, ActivityMetricAlertNotificationData):
            metric_issue_context = _build_metric_issue_context_from_activity(data)

        organization = Organization.objects.get_from_cache(id=data.organization_id)
        detector = Detector.objects.get(id=data.detector_id)
        alert_context = data.alert_context.to_alert_context()
        open_period_context = data.open_period_context

        chart_url = None
        if features.has("organizations:metric-alert-chartcuterie", organization):
            try:
                chart_url = build_metric_alert_chart(
                    organization=organization,
                    alert_rule_serialized_response=get_alert_rule_serializer(detector),
                    snuba_query=metric_issue_context.snuba_query,
                    alert_context=alert_context,
                    open_period_context=open_period_context,
                    subscription=metric_issue_context.subscription,
                    detector_serialized_response=get_detector_serializer(detector),
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)

        slack_body = SlackIncidentsMessageBuilder(
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            organization=organization,
            date_started=open_period_context.date_started,
            chart_url=chart_url,
            notification_uuid=data.notification_uuid,
        ).build()

        renderable = SlackRenderable(
            blocks=slack_body.get("blocks", []),
            text=slack_body.get("text", ""),
        )
        if (color := slack_body.get("color")) is not None:
            renderable["color"] = color

        return renderable
