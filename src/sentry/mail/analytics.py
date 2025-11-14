from typing import int
from sentry import analytics
from sentry.analytics.events.base_notification_sent import BaseNotificationSent


@analytics.eventclass("integrations.email.notification_sent")
class EmailNotificationSent(BaseNotificationSent):
    pass


analytics.register(EmailNotificationSent)
