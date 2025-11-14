from typing import int
from sentry import analytics
from sentry.analytics.events.base_notification_sent import BaseNotificationSent


@analytics.eventclass("integrations.opsgenie.notification_sent")
class OpsgenieIntegrationNotificationSent(BaseNotificationSent):
    pass


analytics.register(OpsgenieIntegrationNotificationSent)
