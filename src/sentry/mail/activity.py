from typing import Any, Mapping

from sentry import options
from sentry.models import ProjectOption, User
from sentry.notifications.activity.base import ActivityNotification
from sentry.notifications.notify import register_notification_provider
from sentry.types.integrations import ExternalProviders
from sentry.utils import json
from sentry.utils.email import MessageBuilder, group_id_to_email
from sentry.utils.linksign import generate_signed_link


def get_headers(notification: ActivityNotification) -> Mapping[str, Any]:
    headers = {
        "X-Sentry-Project": notification.project.slug,
        "X-SMTPAPI": json.dumps({"category": notification.get_category()}),
    }

    if notification.group:
        headers.update(
            {
                "X-Sentry-Logger": notification.group.logger,
                "X-Sentry-Logger-Level": notification.group.get_level_display(),
                "X-Sentry-Reply-To": group_id_to_email(notification.group.id),
            }
        )

    return headers


def get_subject_with_prefix(notification: ActivityNotification) -> bytes:
    prefix = str(
        ProjectOption.objects.get_value(project=notification.project, key="mail:subject_prefix")
        or options.get("mail.subject-prefix")
    )
    return f"{prefix}{notification.get_subject()}".encode("utf-8")


def get_email_type(notification: ActivityNotification) -> str:
    return f"notify.activity.{notification.activity.get_type_display()}"


def get_unsubscribe_link(user_id: int, group_id: int) -> str:
    return generate_signed_link(
        user_id,
        "sentry-account-email-unsubscribe-issue",
        kwargs={"issue_id": group_id},
    )


def can_users_unsubscribe(notification: ActivityNotification) -> bool:
    return bool(notification.group)


def get_context(
    notification, user: User, reason: int, shared_context: Mapping[str, Any]
) -> Mapping[str, Any]:
    """
    Compose the various levels of context and add email-specific fields. The
    generic HTML/text templates only render the unsubscribe link if one is
    present in the context, so don't automatically add it to every message.
    """
    context = {
        **shared_context,
        **notification.get_user_context(user, reason),
    }
    if can_users_unsubscribe(notification) and notification.group:
        context.update({"unsubscribe_link": get_unsubscribe_link(user.id, notification.group.id)})

    return context


@register_notification_provider(ExternalProviders.EMAIL)
def send_notification_as_email(
    notification: ActivityNotification,
    users: Mapping[User, int],
    shared_context: Mapping[str, Any],
) -> None:
    headers = get_headers(notification)
    subject = get_subject_with_prefix(notification)
    type = get_email_type(notification)

    for user, reason in users.items():
        msg = MessageBuilder(
            subject=subject,
            template=notification.get_template(),
            html_template=notification.get_html_template(),
            headers=headers,
            type=type,
            context=get_context(notification, user, reason, shared_context),
            reference=notification.activity,
            reply_reference=notification.group,
        )
        msg.add_users([user.id], project=notification.project)
        msg.send_async()
