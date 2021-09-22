import logging
from datetime import datetime
from typing import TYPE_CHECKING, Any, Mapping, Optional

from django.utils import timezone

from .emails import generate_security_email

if TYPE_CHECKING:
    from sentry.models import User


logger = logging.getLogger("sentry.security")


def capture_security_activity(
    account: "User",
    type: str,
    actor: "User",
    ip_address: str,
    context: Optional[Mapping[str, Any]] = None,
    send_email: bool = True,
    current_datetime: Optional[datetime] = None,
) -> None:
    if current_datetime is None:
        current_datetime = timezone.now()

    logger_context = {"ip_address": ip_address, "user_id": account.id, "actor_id": actor.id}

    if type == "mfa-removed" or type == "mfa-added":
        logger_context["authenticator_id"] = context["authenticator"].id

    logger.info(f"user.{type}", extra=logger_context)

    if send_email:
        msg = generate_security_email(
            account=account,
            type=type,
            actor=actor,
            ip_address=ip_address,
            context=context,
            current_datetime=current_datetime,
        )
        msg.send_async([account.email])
