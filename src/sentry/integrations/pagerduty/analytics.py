from typing import int
from sentry import analytics
from sentry.analytics.events.base_notification_sent import BaseNotificationSent


@analytics.eventclass("integrations.pagerduty.notification_sent")
class PagerdutyIntegrationNotificationSent(BaseNotificationSent):
    pass


analytics.register(PagerdutyIntegrationNotificationSent)
