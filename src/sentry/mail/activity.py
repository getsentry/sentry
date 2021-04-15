from typing import Any, Mapping

from sentry.models import User
from sentry.notifications.activity.base import ActivityNotification, register
from sentry.types.integrations import ExternalProviders
from sentry.utils.email import MessageBuilder


@register(ExternalProviders.EMAIL)
def send_notification_as_email(
    notification: ActivityNotification, user: User, context: Mapping[str, Any]
) -> None:
    msg = MessageBuilder(
        subject=notification.get_subject_with_prefix(),
        template=notification.get_template(),
        html_template=notification.get_html_template(),
        headers=notification.get_headers(),
        type=notification.get_email_type(),
        context=context,
        reference=notification.activity,
        reply_reference=notification.group,
    )
    msg.add_users([user.id], project=notification.project)
    msg.send_async()
