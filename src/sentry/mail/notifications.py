import logging
from typing import Any, Mapping, Optional, Set

from django.utils.encoding import force_text

from sentry import options
from sentry.models import Project, ProjectOption, User
from sentry.notifications.notifications.activity.base import ActivityNotification
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notifications.rules import AlertRuleNotification
from sentry.notifications.notify import register_notification_provider
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

    group = getattr(notification, "group", None)
    if group:
        headers.update(
            {
                "X-Sentry-Logger": group.logger,
                "X-Sentry-Logger-Level": group.get_level_display(),
                "X-Sentry-Reply-To": group_id_to_email(group.id),
            }
        )

    return headers


def build_subject_prefix(project: Project, mail_option_key: Optional[str] = None) -> str:
    key = mail_option_key or "mail:subject_prefix"
    return force_text(
        ProjectOption.objects.get_value(project, key) or options.get("mail.subject-prefix")
    )


def get_subject_with_prefix(
    notification: BaseNotification,
    context: Optional[Mapping[str, Any]] = None,
    mail_option_key: Optional[str] = None,
) -> bytes:

    prefix = build_subject_prefix(notification.project, mail_option_key)
    return f"{prefix}{notification.get_subject(context)}".encode()


def get_unsubscribe_link(
    user_id: int, resource_id: int, key: str = "issue", referrer: Optional[str] = None
) -> str:
    return generate_signed_link(
        user_id,
        f"sentry-account-email-unsubscribe-{key}",
        referrer,
        kwargs={f"{key}_id": resource_id},
    )


def log_message(notification: BaseNotification, user: User) -> None:
    extra = {
        "project_id": notification.project.id,
        "user_id": user.id,
    }
    group = getattr(notification, "group", None)
    if group:
        extra.update({"group": group.id})

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
    if notification.get_unsubscribe_key():
        key, resource_id, referrer = notification.get_unsubscribe_key()
        context.update(
            {"unsubscribe_link": get_unsubscribe_link(user.id, resource_id, key, referrer)}
        )

    return context


@register_notification_provider(ExternalProviders.EMAIL)
def send_notification_as_email(
    notification: BaseNotification,
    users: Set[User],
    shared_context: Mapping[str, Any],
    extra_context_by_user_id: Optional[Mapping[int, Mapping[str, Any]]],
) -> None:
    headers = get_headers(notification)

    for user in users:
        extra_context = (extra_context_by_user_id or {}).get(user.id, {})
        log_message(notification, user)
        context = get_context(notification, user, shared_context, extra_context)
        subject = get_subject_with_prefix(notification, context=context)
        msg = MessageBuilder(
            subject=subject,
            context=context,
            template=notification.get_template(),
            html_template=notification.get_html_template(),
            headers=headers,
            reference=notification.get_reference(),
            reply_reference=notification.get_reply_reference(),
            type=notification.get_type(),
        )
        msg.add_users([user.id], project=notification.project)
        msg.send_async()
