from __future__ import absolute_import

from sentry import analytics


class MetricAlertCreatedEvent(analytics.Event):
    type = "metric_alert.created"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("rule_id"),
    )


analytics.register(MetricAlertCreatedEvent)
