from __future__ import annotations

import logging
from datetime import datetime
from typing import TYPE_CHECKING, Any, Mapping, Optional

from django.contrib.auth.models import AnonymousUser
from django.utils import timezone

from sentry.services.hybrid_cloud.user.model import RpcUser

from .emails import generate_security_email

if TYPE_CHECKING:
    from sentry.models.user import User


logger = logging.getLogger("sentry.security")


def capture_security_activity(
    account: User | RpcUser | AnonymousUser,
    type: str,  # FIXME: "type" is a built-in function, so this isn't a great name
    actor: User | RpcUser | AnonymousUser,
    ip_address: str,
    context: Optional[Mapping[str, Any]] = None,
    send_email: bool = True,
    current_datetime: Optional[datetime] = None,
) -> None:
    if current_datetime is None:
        current_datetime = timezone.now()

    assert not isinstance(account, AnonymousUser)

    logger_context = {"ip_address": ip_address, "user_id": account.id, "actor_id": actor.id}

    if type == "mfa-removed" or type == "mfa-added":
        assert context is not None
        logger_context["authenticator_id"] = context["authenticator"].id

    logger.info("user.%s", type, extra=logger_context)

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
