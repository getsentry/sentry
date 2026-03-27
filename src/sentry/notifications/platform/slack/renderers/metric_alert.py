from __future__ import annotations

import sentry_sdk

from sentry import features
from sentry.incidents.charts import build_metric_alert_chart
from sentry.integrations.slack.message_builder.incidents import SlackIncidentsMessageBuilder
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.templates.metric_alert import BaseMetricAlertNotificationData
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
)


class SlackMetricAlertRenderer(NotificationRenderer[SlackRenderable]):
    provider_key = NotificationProviderKey.SLACK

    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        if not isinstance(data, BaseMetricAlertNotificationData):
            raise ValueError(f"SlackMetricAlertRenderer does not support {data.__class__.__name__}")

        organization = data.organization

        # Rebuild MetricIssueContext — each subclass implements this differently
        metric_issue_context = data.build_metric_issue_context()

        # Deserialize pre-computed contexts (no Action/Detector/GroupOpenPeriod re-queries)
        alert_context = data.alert_context.to_alert_context()
        open_period_context = data.open_period_context.to_open_period_context()

        chart_url = None
        if features.has("organizations:metric-alert-chartcuterie", organization):
            try:
                chart_url = build_metric_alert_chart(
                    organization=organization,
                    alert_rule_serialized_response=data.serialized_alert_rule,
                    snuba_query=metric_issue_context.snuba_query,
                    alert_context=alert_context,
                    open_period_context=open_period_context,
                    subscription=metric_issue_context.subscription,
                    detector_serialized_response=data.serialized_detector,
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)

        # Build the Slack blocks using the existing metric alert builder
        slack_body = SlackIncidentsMessageBuilder(
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            organization=organization,
            date_started=open_period_context.date_started,
            chart_url=chart_url,
            notification_uuid=data.notification_uuid,
        ).build()

        return SlackRenderable(
            blocks=slack_body.get("blocks", []),
            text=slack_body.get("text", ""),
        )
