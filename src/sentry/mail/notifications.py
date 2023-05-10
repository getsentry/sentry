from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping

import sentry_sdk
from django.utils.encoding import force_text

from sentry import options
from sentry.models import Project, ProjectOption, Team
from sentry.notifications.notifications.base import BaseNotification, ProjectNotification
from sentry.notifications.notify import register_notification_provider
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.types.integrations import ExternalProviders
from sentry.utils import json
from sentry.utils.email import MessageBuilder, group_id_to_email
from sentry.utils.linksign import generate_signed_link

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from sentry.services.hybrid_cloud.user import RpcUser


def get_headers(notification: BaseNotification) -> Mapping[str, Any]:
    headers = {"X-SMTPAPI": json.dumps({"category": notification.metrics_key})}
    if isinstance(notification, ProjectNotification):
        headers["X-Sentry-Project"] = notification.project.slug

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


def build_subject_prefix(project: Project) -> str:
    # Explicitly typing to satisfy mypy.
    subject_prefix: str = force_text(
        ProjectOption.objects.get_value(project, "mail:subject_prefix")
        or options.get("mail.subject-prefix")
    )
    return subject_prefix


def get_subject_with_prefix(
    notification: BaseNotification,
    context: Mapping[str, Any] | None = None,
) -> bytes:
    prefix = ""
    if isinstance(notification, ProjectNotification):
        prefix = f"{build_subject_prefix(notification.project).rstrip()} "

    return f"{prefix}{notification.get_subject(context)}".encode()


def get_unsubscribe_link(
    user_id: int, resource_id: int, key: str = "issue", referrer: str | None = None
) -> str:
    signed_link: str = generate_signed_link(
        user_id,
        f"sentry-account-email-unsubscribe-{key}",
        referrer,
        kwargs={f"{key}_id": resource_id},
    )
    return signed_link


def _log_message(notification: BaseNotification, recipient: RpcActor) -> None:
    extra = notification.get_log_params(recipient)
    logger.info("mail.adapter.notify.mail_user", extra={**extra})


def get_context(
    notification: BaseNotification,
    recipient: RpcActor | Team | RpcUser,
    shared_context: Mapping[str, Any],
    extra_context: Mapping[str, Any],
) -> Mapping[str, Any]:
    """
    Compose the various levels of context and add email-specific fields. The
    generic HTML/text templates only render the unsubscribe link if one is
    present in the context, so don't automatically add it to every message.
    """
    recipient_actor = RpcActor.from_object(recipient)
    context = {
        **shared_context,
        **notification.get_recipient_context(recipient_actor, extra_context),
    }
    # TODO(mgaeta): The unsubscribe system relies on `user_id` so it doesn't
    #  work with Teams. We should add the `actor_id` to the signed link.
    unsubscribe_key = notification.get_unsubscribe_key()
    if recipient_actor.actor_type == ActorType.USER and unsubscribe_key:
        key, resource_id, referrer = unsubscribe_key
        context.update(
            {
                "unsubscribe_link": get_unsubscribe_link(
                    recipient_actor.id, resource_id, key, referrer
                )
            }
        )

    return context


@register_notification_provider(ExternalProviders.EMAIL)
def send_notification_as_email(
    notification: BaseNotification,
    recipients: Iterable[RpcActor],
    shared_context: Mapping[str, Any],
    extra_context_by_actor: Mapping[RpcActor, Mapping[str, Any]] | None,
) -> None:
    for recipient in recipients:
        recipient_actor = RpcActor.from_object(recipient)
        with sentry_sdk.start_span(op="notification.send_email", description="one_recipient"):
            if recipient_actor.actor_type == ActorType.TEAM:
                # TODO(mgaeta): MessageBuilder only works with Users so filter out Teams for now.
                continue
            _log_message(notification, recipient_actor)

            with sentry_sdk.start_span(op="notification.send_email", description="build_message"):
                msg = MessageBuilder(
                    **get_builder_args(
                        notification, recipient_actor, shared_context, extra_context_by_actor
                    )
                )

            with sentry_sdk.start_span(op="notification.send_email", description="send_message"):
                # TODO: find better way of handling this
                add_users_kwargs = {}
                if isinstance(notification, ProjectNotification):
                    add_users_kwargs["project"] = notification.project
                msg.add_users([recipient.id], **add_users_kwargs)
                msg.send_async()
            notification.record_notification_sent(recipient_actor, ExternalProviders.EMAIL)


def get_builder_args(
    notification: BaseNotification,
    recipient: RpcActor,
    shared_context: Mapping[str, Any] | None = None,
    extra_context_by_actor: Mapping[RpcActor, Mapping[str, Any]] | None = None,
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
        "headers": get_headers(notification),
        "reference": notification.reference,
        "type": notification.metrics_key,
    }
    # add in optinal fields
    from_email = notification.from_email
    if from_email:
        output["from_email"] = from_email
    return output
