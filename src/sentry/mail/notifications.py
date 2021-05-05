import logging
from typing import Any, Mapping, Optional, Set

from sentry import options
from sentry.models import ProjectOption, User
from sentry.notifications.activity.base import ActivityNotification
from sentry.notifications.base import BaseNotification
from sentry.notifications.notify import register_notification_provider
from sentry.notifications.rules import AlertRuleNotification
from sentry.types.integrations import ExternalProviders
from sentry.utils import json
from sentry.utils.email import MessageBuilder, group_id_to_email
from sentry.utils.linksign import generate_signed_link

logger = logging.getLogger(__name__)


def get_headers(notification: BaseNotification) -> Mapping[str, Any]:
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


def get_subject_with_prefix(
    notification: BaseNotification, mail_option_key: Optional[str] = None
) -> bytes:
    key = mail_option_key or "mail:subject_prefix"
    prefix = str(
        ProjectOption.objects.get_value(notification.project, key)
        or options.get("mail.subject-prefix")
    )
    return f"{prefix}{notification.get_subject()}".encode("utf-8")


def get_email_type(notification: BaseNotification) -> str:
    if isinstance(notification, ActivityNotification):
        return f"notify.activity.{notification.activity.get_type_display()}"
    elif isinstance(notification, AlertRuleNotification):
        return "notify.error"
    return ""


def get_unsubscribe_link(user_id: int, group_id: int) -> str:
    return generate_signed_link(
        user_id,
        "sentry-account-email-unsubscribe-issue",
        kwargs={"issue_id": group_id},
    )


def can_users_unsubscribe(notification: BaseNotification) -> bool:
    return bool(notification.group)


def log_message(notification: BaseNotification, user: User) -> None:
    extra = {
        "project_id": notification.project.id,
        "user_id": user.id,
    }
    if notification.group:
        extra.update({"group": notification.group.id})

    if isinstance(notification, AlertRuleNotification):
        extra.update(
            {
                "target_type": notification.target_type,
                "target_identifier": notification.target_identifier,
            }
        )
    elif isinstance(notification, ActivityNotification):
        extra.update({"activity": notification.activity})

    logger.info("mail.adapter.notify.mail_user", extra=extra)


def get_context(
    notification: BaseNotification,
    user: User,
    shared_context: Mapping[str, Any],
    extra_context: Mapping[str, Any],
) -> Mapping[str, Any]:
    """
    Compose the various levels of context and add email-specific fields. The
    generic HTML/text templates only render the unsubscribe link if one is
    present in the context, so don't automatically add it to every message.
    """
    context = {
        **shared_context,
        **notification.get_user_context(user, extra_context),
    }
    if can_users_unsubscribe(notification) and notification.group:
        context.update({"unsubscribe_link": get_unsubscribe_link(user.id, notification.group.id)})

    return context


@register_notification_provider(ExternalProviders.EMAIL)
def send_notification_as_email(
    notification: BaseNotification,
    users: Set[User],
    shared_context: Mapping[str, Any],
    extra_context_by_user_id: Optional[Mapping[int, Mapping[str, Any]]],
) -> None:
    headers = get_headers(notification)
    subject = get_subject_with_prefix(notification)
    type = get_email_type(notification)

    for user in users:
        extra_context = (extra_context_by_user_id or {}).get(user.id, {})
        log_message(notification, user)
        msg = MessageBuilder(
            subject=subject,
            context=get_context(notification, user, shared_context, extra_context),
            template=notification.get_template(),
            html_template=notification.get_html_template(),
            headers=headers,
            reference=notification.get_reference(),
            reply_reference=notification.get_reply_reference(),
            type=type,
        )
        msg.add_users([user.id], project=notification.project)
        msg.send_async()
