import logging
from typing import Any, Iterable, Mapping, Optional, Union

from django.utils.encoding import force_text

from sentry import options
from sentry.models import Project, ProjectOption, Team, User
from sentry.notifications.notifications.base import BaseNotification, ProjectNotification
from sentry.notifications.notify import register_notification_provider
from sentry.types.integrations import ExternalProviders
from sentry.utils.email import MessageBuilder
from sentry.utils.linksign import generate_signed_link

logger = logging.getLogger(__name__)


def build_subject_prefix(project: "Project") -> str:
    key = "mail:subject_prefix"
    return str(
        force_text(
            ProjectOption.objects.get_value(project, key) or options.get("mail.subject-prefix")
        )
    )


def get_unsubscribe_link(
    user_id: int, resource_id: int, key: str = "issue", referrer: Optional[str] = None
) -> str:
    return str(
        generate_signed_link(
            user_id,
            f"sentry-account-email-unsubscribe-{key}",
            referrer,
            kwargs={f"{key}_id": resource_id},
        )
    )


def log_message(notification: BaseNotification, recipient: Union["Team", "User"]) -> None:
    extra = notification.get_log_params(recipient)
    logger.info("mail.adapter.notify.mail_user", extra=extra)


def get_context(
    notification: BaseNotification,
    recipient: Union["Team", "User"],
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
        **notification.get_recipient_context(recipient, extra_context),
    }
    # TODO(mgaeta): The unsubscribe system relies on `user_id` so it doesn't
    #  work with Teams. We should add the `actor_id` to the signed link.
    unsubscribe_key = notification.get_unsubscribe_key()
    if isinstance(recipient, User) and unsubscribe_key:
        key, resource_id, referrer = unsubscribe_key
        context.update(
            {"unsubscribe_link": get_unsubscribe_link(recipient.id, resource_id, key, referrer)}
        )

    return context


@register_notification_provider(ExternalProviders.EMAIL)
def send_notification_as_email(
    notification: BaseNotification,
    recipients: Iterable[Union["Team", "User"]],
    shared_context: Mapping[str, Any],
    extra_context_by_user_id: Optional[Mapping[int, Mapping[str, Any]]],
) -> None:
    for recipient in recipients:
        if isinstance(recipient, Team):
            # TODO(mgaeta): MessageBuilder only works with Users so filter out Teams for now.
            continue
        log_message(notification, recipient)
        msg = MessageBuilder(
            **get_builder_args(notification, recipient, shared_context, extra_context_by_user_id)
        )
        # TODO: find better way of handling this
        if isinstance(notification, ProjectNotification):
            msg.add_users([recipient.id], project=notification.project)
        msg.send_async()


def get_builder_args(
    notification: BaseNotification,
    recipient: "User",
    shared_context: Optional[Mapping[str, Any]],
    extra_context_by_user_id: Optional[Mapping[int, Mapping[str, Any]]],
) -> Mapping[str, Any]:
    extra_context = (extra_context_by_user_id or {}).get(recipient.id, {})
    context = get_context(notification, recipient, shared_context or {}, extra_context)
    return {
        "subject": notification.get_subject_with_prefix(context=context),
        "context": context,
        "template": notification.get_template(),
        "html_template": notification.get_html_template(),
        "headers": notification.get_headers(),
        "reference": notification.get_reference(),
        "reply_reference": notification.get_reply_reference(),
        "type": notification.get_type(),
    }
