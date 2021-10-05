from datetime import datetime
from typing import TYPE_CHECKING, Any, Mapping, Optional

from django.utils import timezone

from sentry.utils.email import MessageBuilder

if TYPE_CHECKING:
    from sentry.models import User


def generate_security_email(
    account: "User",
    type: str,
    actor: "User",
    ip_address: str,
    context: Optional[Mapping[str, Any]] = None,
    current_datetime: Optional[datetime] = None,
) -> MessageBuilder:
    if current_datetime is None:
        current_datetime = timezone.now()

    subject = "Security settings changed"
    if type == "mfa-removed":
        assert "authenticator" in context
        template = "sentry/emails/mfa-removed.txt"
        html_template = "sentry/emails/mfa-removed.html"
    elif type == "mfa-added":
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
