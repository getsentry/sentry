from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from typing import TYPE_CHECKING, Any

from django.contrib.auth.models import AnonymousUser
from django.utils import timezone

from sentry.users.services.user.model import RpcUser
from sentry.utils.email import MessageBuilder

if TYPE_CHECKING:
    from sentry.users.models.user import User


def generate_security_email(
    account: User | RpcUser,
    type: str,
    actor: AnonymousUser | User | RpcUser,
    ip_address: str,
    context: Mapping[str, Any] | None = None,
    current_datetime: datetime | None = None,
) -> MessageBuilder:
    if current_datetime is None:
        current_datetime = timezone.now()

    subject = "Security settings changed"
    if type == "mfa-removed":
        assert context is not None
        assert "authenticator" in context
        template = "sentry/emails/mfa-removed.txt"
        html_template = "sentry/emails/mfa-removed.html"
    elif type == "mfa-added":
        assert context is not None
        assert "authenticator" in context
        template = "sentry/emails/mfa-added.txt"
        html_template = "sentry/emails/mfa-added.html"
    elif type == "password-changed":
        template = "sentry/emails/password-changed.txt"
        html_template = "sentry/emails/password-changed.html"
    elif type == "recovery-codes-regenerated":
        template = "sentry/emails/recovery-codes-regenerated.txt"
        html_template = "sentry/emails/recovery-codes-regenerated.html"
    elif type == "api-token-generated":
        template = "sentry/emails/api-token-generated.txt"
        html_template = "sentry/emails/api-token-generated.html"
    elif type == "org-auth-token-created":
        template = "sentry/emails/org-auth-token-created.txt"
        html_template = "sentry/emails/org-auth-token-created.html"
    else:
        raise ValueError(f"unknown type: {type}")

    new_context = {
        "account": account,
        "actor": actor,
        "ip_address": ip_address,
        "datetime": current_datetime,
    }
    if context:
        new_context.update(context)

    return MessageBuilder(
        subject=subject,
        context=new_context,
        template=template,
        html_template=html_template,
        type=type,
    )
