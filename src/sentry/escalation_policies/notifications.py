import logging
from collections.abc import Iterable, Mapping
from typing import Any

import sentry_sdk

from sentry.integrations.types import ExternalProviders
from sentry.models.organizationmember import OrganizationMember
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notify import register_notification_provider
from sentry.types.actor import Actor
from sentry.utils.sms import send_sms, sms_available

logger = logging.getLogger(__name__)


def _log_message(notification: BaseNotification, recipient: Actor) -> None:
    extra = notification.get_log_params(recipient)
    logger.info("sentry.sms.notification.send", extra={**extra})


@register_notification_provider(ExternalProviders.SMS)
def send_notification_as_sms(
    notification: BaseNotification,
    recipients: Iterable[Actor],
    shared_context: Mapping[str, Any],
    extra_context_by_actor: Mapping[Actor, Mapping[str, Any]] | None,
) -> None:
    if not sms_available():
        logger.warning("SMS backend is not configured. Failed to fire notification.")
        return

    for recipient in recipients:
        recipient_actor = Actor.from_object(recipient)
        with sentry_sdk.start_span(op="notification.send_sms", name="one_recipient"):
            if recipient_actor.is_team:
                # TODO(mgaeta): SMS only works with Users so filter out Teams for now.
                continue

            # We only push one phone number to the region silos and store it on OrgMember
            phone = OrganizationMember.objects.get(user_id=recipient_actor.id).user_phone
            if phone is None:
                logger.warning(
                    "User %s has no phone number. Failed to fire notification.",
                    recipient_actor.id,
                )
                continue

            _log_message(notification, recipient_actor)

            with sentry_sdk.start_span(op="notification.send_sms", name="send_message"):
                # TODO: ADD RATE LIMITS, USE AUTHENTICATOR MODEL
                send_sms(
                    f"Yo, brah, you should acknowledge this incident: {shared_context["group"].title}",
                    to=phone,
                )

            notification.record_notification_sent(recipient_actor, ExternalProviders.SMS)
