from __future__ import annotations

import logging
from collections.abc import Iterable, Mapping, MutableMapping
from typing import TYPE_CHECKING, Any, TypeVar

import orjson
import sentry_sdk
from django.utils.encoding import force_str

from sentry import options
from sentry.integrations.types import ExternalProviders
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.notifications.notifications.base import BaseNotification, ProjectNotification
from sentry.notifications.notify import register_notification_provider
from sentry.notifications.types import UnsubscribeContext
from sentry.types.actor import Actor
from sentry.users.models.user import User
from sentry.utils.email import MessageBuilder, group_id_to_email
from sentry.utils.linksign import generate_signed_unsubscribe_link

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from sentry.users.services.user import RpcUser


def get_headers(
    notification: BaseNotification, context: MutableMapping[str, Any]
) -> Mapping[str, Any]:
    headers = {"X-SMTPAPI": orjson.dumps({"category": notification.metrics_key}).decode()}
    if isinstance(notification, ProjectNotification) and notification.project.slug:
        headers["X-Sentry-Project"] = notification.project.slug

    group = getattr(notification, "group", None)
    if group:
        headers.update(
            {
                "X-Sentry-Logger": group.logger,
                "X-Sentry-Logger-Level": group.get_level_display(),
                "X-Sentry-Reply-To": group_id_to_email(group.id, group.project.organization_id),
            }
        )
    if context.get("reply_to", None):
        headers["X-Sentry-Reply-To"] = context["reply_to"]

    return headers


def build_subject_prefix(project: Project) -> str:
    return force_str(
        ProjectOption.objects.get_value(project, "mail:subject_prefix")
        or options.get("mail.subject-prefix")
    )


def get_subject_with_prefix(
    notification: BaseNotification,
    context: Mapping[str, Any] | None = None,
) -> bytes:
    prefix = ""
    if isinstance(notification, ProjectNotification):
        prefix = f"{build_subject_prefix(notification.project).rstrip()} "

    return f"{prefix}{notification.get_subject(context)}".encode()


def get_unsubscribe_link(user_id: int, data: UnsubscribeContext) -> str:
    return generate_signed_unsubscribe_link(
        organization=data.organization,
        user_id=user_id,
        resource=data.key,
        referrer=data.referrer,
        resource_id=data.resource_id,
    )


def _log_message(notification: BaseNotification, recipient: Actor) -> None:
    extra = notification.get_log_params(recipient)
    logger.info("mail.adapter.notify.mail_user", extra={**extra})


def get_context(
    notification: BaseNotification,
    recipient: Actor | Team | RpcUser | User,
    shared_context: Mapping[str, Any],
    extra_context: Mapping[str, Any],
) -> Mapping[str, Any]:
    """
    Compose the various levels of context and add email-specific fields. The
    generic HTML/text templates only render the unsubscribe link if one is
    present in the context, so don't automatically add it to every message.
    """
    recipient_actor = Actor.from_object(recipient)
    context = {
        **shared_context,
        **notification.get_recipient_context(recipient_actor, extra_context),
    }
    # TODO: The unsubscribe system relies on `user_id` so it doesn't
    # work with Teams.
    unsubscribe_key = notification.get_unsubscribe_key()
    if recipient_actor.is_user and unsubscribe_key:
        context.update(
            {"unsubscribe_link": get_unsubscribe_link(recipient_actor.id, unsubscribe_key)}
        )

    return context


@register_notification_provider(ExternalProviders.EMAIL)
def send_notification_as_email(
    notification: BaseNotification,
    recipients: Iterable[Actor],
    shared_context: Mapping[str, Any],
    extra_context_by_actor: Mapping[Actor, Mapping[str, Any]] | None,
) -> None:
    for recipient in recipients:
        recipient_actor = Actor.from_object(recipient)
        with sentry_sdk.start_span(op="notification.send_email", name="one_recipient"):
            if recipient_actor.is_team:
                # TODO(mgaeta): MessageBuilder only works with Users so filter out Teams for now.
                continue
            _log_message(notification, recipient_actor)

            with sentry_sdk.start_span(op="notification.send_email", name="build_message"):
                msg = MessageBuilder(
                    **get_builder_args(
                        notification, recipient_actor, shared_context, extra_context_by_actor
                    )
                )

            with sentry_sdk.start_span(op="notification.send_email", name="send_message"):
                # TODO: find better way of handling this
                add_users_kwargs = {}
                if isinstance(notification, ProjectNotification):
                    add_users_kwargs["project"] = notification.project
                msg.add_users([recipient.id], **add_users_kwargs)
                msg.send_async()
            notification.record_notification_sent(recipient_actor, ExternalProviders.EMAIL)


RecipientT = TypeVar("RecipientT", Actor, User)


def get_builder_args(
    notification: BaseNotification,
    recipient: RecipientT,
    shared_context: Mapping[str, Any] | None = None,
    extra_context_by_actor: Mapping[RecipientT, Mapping[str, Any]] | None = None,
) -> Mapping[str, Any]:
    # TODO: move context logic to single notification class method
    extra_context = (
        extra_context_by_actor[recipient] if extra_context_by_actor and recipient else {}
    )
    context = get_context(notification, recipient, shared_context or {}, extra_context)
    return get_builder_args_from_context(notification, context)


def get_builder_args_from_context(
    notification: BaseNotification, context: Mapping[str, Any]
) -> MutableMapping[str, Any]:
    output = {
        "subject": get_subject_with_prefix(notification, context),
        "context": context,
        "template": f"{notification.template_path}.txt",
        "html_template": f"{notification.template_path}.html",
        "headers": get_headers(notification, context),
        "reference": notification.reference,
        "type": notification.metrics_key,
    }
    # add in optinal fields
    from_email = notification.from_email
    if from_email:
        output["from_email"] = from_email
    return output
