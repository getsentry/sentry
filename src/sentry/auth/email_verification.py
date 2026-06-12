from __future__ import annotations

import hashlib
import logging
import time

from django.core.signing import SignatureExpired
from django.http import HttpRequest
from django.urls import reverse

from sentry import options
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign, unsign

logger = logging.getLogger("sentry.auth.email_verification")

DEFAULT_MAX_AGE_MINUTES = 120


def _get_salt() -> str:
    return options.get("auth.signup-verification-email-salt")


def _format_expiry(minutes: int) -> str:
    """Convert minutes to a human-friendly expiry string."""
    if minutes >= 60 and minutes % 60 == 0:
        hours = minutes // 60
        return f"{hours} hour{'s' if hours != 1 else ''}"
    return f"{minutes} minute{'s' if minutes != 1 else ''}"


def send_signup_verification_email(
    request: HttpRequest,
    email: str,
    max_age_minutes: int = DEFAULT_MAX_AGE_MINUTES,
) -> None:
    """
    Send a verification email for signup flows.

    Signs {email, session_id, expires_at} into a URL-safe blob.
    The recipient clicks the link to prove email ownership.
    """
    if not request.session.session_key:
        request.session.create()

    payload = {
        "email": email,
        "session_id": request.session.session_key,
        "expires_at": time.time() + (max_age_minutes * 60),
    }
    signed_data = sign(salt=_get_salt(), **payload)

    url = absolute_uri(reverse("sentry-signup-verify-email", args=[signed_data]))

    context = {
        "confirm_email": email,
        "url": url,
        "is_new_user": True,
        "expiry_text": _format_expiry(max_age_minutes),
    }

    msg = MessageBuilder(
        subject="{}Confirm Email".format(options.get("mail.subject-prefix")),
        template="sentry/emails/confirm_email.txt",
        html_template="sentry/emails/confirm_email.html",
        type="user.confirm_email",
        context=context,
    )
    msg.send_async([email])

    logger.info(
        "signup_verification.sent",
        extra={"email_hash": hashlib.sha256(email.lower().encode()).hexdigest()},
    )


def unsign_signup_verification(signed_data: str, request: HttpRequest) -> dict:
    """
    Verify and decode a signup verification link.

    Returns the decoded payload dict with keys: email, session_id, expires_at.

    Because expiration varies, the send side embeds expires_at in the signed payload.
    We unsign without checking expiration so we can use the value from the payload.

    Raises BadSignature, SignatureExpired, ValueError on failure.
    """
    payload = unsign(signed_data, salt=_get_salt(), max_age=None)
    if time.time() > payload["expires_at"]:
        raise SignatureExpired("Verification link expired")
    if payload["session_id"] != request.session.session_key:
        raise ValueError("Session mismatch")
    return payload
