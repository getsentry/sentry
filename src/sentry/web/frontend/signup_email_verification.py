from __future__ import annotations

import logging

from django.conf import settings
from django.core.signing import BadSignature, SignatureExpired
from django.http import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache

from sentry import options
from sentry.auth.email_verification import unsign_signup_verification
from sentry.utils.hashlib import sha256_text
from sentry.web.frontend.base import BaseView, control_silo_view

PENDING_VERIFICATION_SESSION_KEY = "pending_signup_verification_email"
VERIFIED_SESSION_KEY = "verified_email"

logger = logging.getLogger("sentry.auth.signup_email_verification")


def _get_signup_url() -> str:
    return settings.SENTRY_SIGNUP_URL or "/auth/login/"


@control_silo_view
class SignupEmailVerificationView(BaseView):
    auth_required = False

    def _render_error(self, title: str, message: str) -> HttpResponseBase:
        context = {
            "title": title,
            "message": message,
            "signup_url": _get_signup_url(),
        }
        return self.respond("sentry/signup-verification-error.html", context=context, status=400)

    @method_decorator(never_cache)
    def handle(self, request: HttpRequest, signed_data: str) -> HttpResponseBase:
        if not options.get("auth.email-verification-at-signup"):
            return self.redirect(_get_signup_url())

        try:
            payload = unsign_signup_verification(signed_data)
        except SignatureExpired:
            return self._render_error(
                title="Link expired",
                message="This verification link has expired. Please restart the signup process.",
            )
        except (BadSignature, ValueError):
            return self._render_error(
                title="Verification error",
                message="Something went wrong. Please restart the signup process.",
            )

        # enforce same session
        email = payload["email"].lower()
        email_in_session = request.session.get(PENDING_VERIFICATION_SESSION_KEY)
        if not email_in_session or email_in_session.lower() != email:
            return self._render_error(
                title="Verification error",
                message="Please open this link in the same browser where you started signing up, or restart the signup process.",
            )

        request.session[VERIFIED_SESSION_KEY] = email

        logger.info(
            "signup_verification.verified",
            extra={"email_hash": sha256_text(email.lower()).hexdigest()},
        )

        # TODO: redirect based on data in session. Different methods for sso, social auth, and email+pword

        return self.redirect(_get_signup_url())
