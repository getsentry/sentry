from __future__ import annotations

import binascii
import logging
import time
from typing import Any

from django.conf import settings
from django.core.signing import BadSignature, SignatureExpired
from django.urls import reverse

from sentry import options
from sentry.utils.dates import format_duration
from sentry.utils.email import MessageBuilder
from sentry.utils.hashlib import sha256_text
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign, unsign

logger = logging.getLogger("sentry.auth.email_verification")


class SignupLinkExpired(SignatureExpired):
    def __init__(self, message: str, email: str) -> None:
        super().__init__(message)
        self.email = email


def hash_email(email: str) -> str:
    """One-way hash for logging and analytics. Not the same hash used for rollout group assignment."""
    return sha256_text(email.lower()).hexdigest()


DEFAULT_MAX_AGE_MINUTES = 120


def send_signup_verification_email(
    email: str,
    url_name: str,
    max_age_minutes: int = DEFAULT_MAX_AGE_MINUTES,
) -> None:
    """
    Send a verification email for signup flows.

    Signs {email, expires_at} into a URL-safe blob and emails the link.
    Pure send function — callers are responsible for session state
    (setting request.session[PENDING_VERIFICATION_SESSION_KEY])

    url_name controls which verification endpoint the link points to,
    allowing different signup methods to have their own completion logic.
    """
    payload = {
        "email": email,
        "expires_at": time.time() + (max_age_minutes * 60),
    }
    signed_data = sign(salt=settings.SIGNUP_VERIFICATION_EMAIL_SALT, **payload)

    url = absolute_uri(reverse(url_name, args=[signed_data]))

    context = {
        "confirm_email": email,
        "url": url,
        "is_new_user": True,
        "expiry_text": format_duration(max_age_minutes, floor_to_largest_unit=False),
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
        extra={"email_hash": hash_email(email)},
    )


def verify_signup_link(signed_data: str) -> dict[str, Any]:
    """
    Verify and decode a signup verification link.

    Returns the decoded payload dict with keys: email, expires_at.

    Because expiration varies by signup method, the send side embeds
    expires_at in the signed payload and we check it here rather than
    using TimestampSigner's max_age.

    Session binding is the caller's responsibility — compare
    payload["email"] against request.session[PENDING_VERIFICATION_SESSION_KEY].

    Raises BadSignature if tampered, SignupLinkExpired (a SignatureExpired
    subclass) if past expires_at.
    """
    try:
        payload = unsign(signed_data, salt=settings.SIGNUP_VERIFICATION_EMAIL_SALT, max_age=None)
    except binascii.Error as e:
        raise BadSignature("Malformed verification link") from e
    if time.time() > payload["expires_at"]:
        raise SignupLinkExpired("Verification link expired", email=payload["email"])
    return payload
