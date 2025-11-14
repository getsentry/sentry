from typing import int
from sentry import analytics
from sentry.analytics.events.base_notification_sent import BaseNotificationSent


@analytics.eventclass("integrations.msteams.notification_sent")
class MSTeamsIntegrationNotificationSent(BaseNotificationSent):
    pass


analytics.register(MSTeamsIntegrationNotificationSent)
