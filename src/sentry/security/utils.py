from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime
from typing import TYPE_CHECKING, Any, int

from django.contrib.auth.models import AnonymousUser
from django.utils import timezone

from sentry.organizations.services.organization.model import RpcOrganization
from sentry.sentry_apps.services.app.model import RpcSentryApp
from sentry.users.services.user.model import RpcUser

from .emails import generate_security_email

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.sentry_apps.models import SentryApp
    from sentry.users.models.user import User


logger = logging.getLogger("sentry.security")


def capture_security_activity(
    account: User | RpcUser | AnonymousUser,
    type: str,  # FIXME: "type" is a built-in function, so this isn't a great name
    actor: User | RpcUser | AnonymousUser,
    ip_address: str,
    context: Mapping[str, Any] | None = None,
    send_email: bool = True,
    current_datetime: datetime | None = None,
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


def capture_security_app_activity(
    organization: Organization | RpcOrganization,
    sentry_app: SentryApp | RpcSentryApp,
    activity_type: str,
    ip_address: str,
    context: Mapping[str, Any] | None = None,
) -> None:
    logger_context = {
        "ip_address": ip_address,
        "organization_id": organization.id,
        "sentry_app_id": sentry_app.id,
    }

    # Add the installation_id if it exists.
    if context:
        if "installation_id" in context:
            logger_context["installation_id"] = context["installation_id"]

    logger.info("audit.sentry_app.%s", activity_type, extra=logger_context)
