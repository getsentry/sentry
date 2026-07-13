from __future__ import annotations

import logging

from django.http import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache

from sentry.auth.email_verification import DEFAULT_MAX_AGE_MINUTES
from sentry.utils.dates import format_duration
from sentry.web.frontend.base import BaseView, control_silo_view
from sentry.web.frontend.signup_email_verification import (
    PENDING_VERIFICATION_SESSION_KEY,
    _get_signup_url,
)

logger = logging.getLogger("getsentry.signup")


@control_silo_view
class SignupVerificationPendingView(BaseView):
    auth_required = False

    @method_decorator(never_cache)
    def handle(self, request: HttpRequest) -> HttpResponseBase:
        email = request.session.get(PENDING_VERIFICATION_SESSION_KEY)
        if not email:
            logger.warning("signup_verification.email_missing_from_session")
            return self.redirect(_get_signup_url())

        context = {
            "email": email,
            "expiry_text": format_duration(DEFAULT_MAX_AGE_MINUTES, floor_to_largest_unit=False),
            "signup_url": _get_signup_url(),
        }
        return self.respond("sentry/signup-verification-pending.html", context=context)
