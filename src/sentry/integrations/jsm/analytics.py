from sentry import analytics
from sentry.analytics.events.base_notification_sent import BaseNotificationSent


@analytics.eventclass("integrations.jsm.notification_sent")
class JsmIntegrationNotificationSent(BaseNotificationSent):
    pass


analytics.register(JsmIntegrationNotificationSent)
