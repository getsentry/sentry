from __future__ import annotations

import logging

from django.conf import settings
from django.core.signing import BadSignature
from django.http import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache

from sentry import analytics
from sentry import ratelimits as ratelimiter
from sentry.analytics.events.signup_email_verification import (
    SignupEmailVerificationClickedEvent,
)
from sentry.auth.email_verification import SignupLinkExpired, hash_email, verify_signup_link
from sentry.utils.hashlib import sha256_text
from sentry.web.frontend.base import BaseView

PENDING_VERIFICATION_SESSION_KEY = "pending_signup_verification_email"
VERIFIED_SESSION_KEY = "verified_email"

logger = logging.getLogger("sentry.auth.signup_email_verification")


def _get_signup_url() -> str:
    return settings.SENTRY_SIGNUP_URL or "/auth/login/"


class BaseSignupVerificationView(BaseView):
    """
    Base class for signup email verification endpoints.

    Handles rate limiting, signed blob validation, and same-browser session
    enforcement. Subclasses implement handle_verified_email() for
    method-specific completion logic.
    """

    auth_required = False

    @staticmethod
    def _record_clicked(request: HttpRequest, outcome: str, email: str | None = None) -> None:
        if email is None:
            email = request.session.get(PENDING_VERIFICATION_SESSION_KEY, "")
        email_hash = hash_email(email) if email else ""
        analytics.record(
            SignupEmailVerificationClickedEvent(
                email_hash=email_hash,
                outcome=outcome,
            )
        )

    @staticmethod
    def _session_fingerprint(request: HttpRequest) -> str:
        # Non-secret hash of the session id, safe to log.
        # Same browser session == same fingerprint.
        # Empty string means the request carried no session.
        session_key = request.session.session_key or ""
        return sha256_text(session_key).hexdigest()[:16] if session_key else ""

    def _render_error(self, title: str, message: str) -> HttpResponseBase:
        context = {
            "title": title,
            "message": message,
            "signup_url": _get_signup_url(),
        }
        return self.respond("sentry/signup-verification-error.html", context=context, status=400)

    @method_decorator(never_cache)
    def handle(self, request: HttpRequest, signed_data: str) -> HttpResponseBase:
        # use the same rate limit strategy as signup endpoint
        ip_address = request.META["REMOTE_ADDR"]
        if ratelimiter.backend.is_limited(f"signup-verify:ip:{ip_address}", limit=5, window=60):
            return self._render_error(
                title="Too many attempts",
                message="Please wait a moment and try again.",
            )
        if ratelimiter.backend.is_limited(
            f"signup-verify:ip:daily:{ip_address}", limit=50, window=86400
        ):
            return self._render_error(
                title="Too many attempts",
                message="Please wait a moment and try again.",
            )

        try:
            payload = verify_signup_link(signed_data)
        except SignupLinkExpired as e:
            self._record_clicked(request, "expired", email=e.email)
            return self._render_error(
                title="Link expired",
                message="This verification link has expired. Please restart the signup process.",
            )
        except (BadSignature, ValueError):
            self._record_clicked(request, "tampered")
            return self._render_error(
                title="Verification error",
                message="Something went wrong. Please restart the signup process.",
            )

        # enforce same session
        email = payload["email"].lower()
        email_in_session = request.session.get(PENDING_VERIFICATION_SESSION_KEY)
        if not email_in_session or email_in_session.lower() != email:
            # TEMP diagnostic: separates a logged-in browser re-hitting the link from a prefetch
            # vs. an anonymous client like an email scanner.
            logger.info(
                "signup_verification.session_mismatch",
                extra={
                    "email_hash": hash_email(email),
                    "is_authenticated": request.user.is_authenticated,
                    "user_id": request.user.id if request.user.is_authenticated else None,
                    "had_pending_email": bool(email_in_session),
                    "session_fingerprint": self._session_fingerprint(request),
                    "method": request.method,
                    "user_agent": request.META.get("HTTP_USER_AGENT", ""),
                    "ip_address": request.META.get("REMOTE_ADDR", ""),
                    "forwarded_for": request.META.get("HTTP_X_FORWARDED_FOR", ""),
                    "sec_purpose": request.headers.get("Sec-Purpose", ""),
                    "purpose": request.headers.get("Purpose", ""),
                    "x_purpose": request.headers.get("X-Purpose", ""),
                    "x_moz": request.headers.get("X-Moz", ""),
                    "sec_fetch_mode": request.headers.get("Sec-Fetch-Mode", ""),
                    "sec_fetch_dest": request.headers.get("Sec-Fetch-Dest", ""),
                    "sec_fetch_site": request.headers.get("Sec-Fetch-Site", ""),
                    "sec_fetch_user": request.headers.get("Sec-Fetch-User", ""),
                },
            )
            self._record_clicked(request, "session_mismatch", email=email)
            return self._render_error(
                title="Verification error",
                message="Please open this link in the same browser where you started signing up, or restart the signup process.",
            )

        request.session[VERIFIED_SESSION_KEY] = email

        logger.info(
            "signup_verification.verified",
            extra={
                "email_hash": hash_email(email),
                "session_fingerprint": self._session_fingerprint(request),
            },
        )
        self._record_clicked(request, "success", email=email)

        return self.handle_verified_email(request, email)

    def handle_verified_email(self, request: HttpRequest, email: str) -> HttpResponseBase:
        """
        Called after the email has been successfully verified.
        Subclasses implement method-specific completion logic.
        """
        raise NotImplementedError
