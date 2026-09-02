from __future__ import annotations

import logging

from django.http import HttpRequest, HttpResponseRedirect
from django.http.response import HttpResponseBase
from django.urls import reverse

from sentry.auth.email_verification import hash_email
from sentry.auth.exceptions import IdentityNotValid, PipelineStateExpired, ProviderMismatch
from sentry.auth.helper import AuthHelper
from sentry.web.frontend.base import control_silo_view
from sentry.web.frontend.signup_email_verification import (
    PENDING_EXPIRY_TEXT_SESSION_KEY,
    PENDING_VERIFICATION_SESSION_KEY,
    BaseSignupVerificationView,
)

logger = logging.getLogger("sentry.auth.sso_signup_verification")


@control_silo_view
class SSOSignupVerificationView(BaseSignupVerificationView):
    """
    Verification endpoint for SSO signup email verification.

    Called when a user clicks the verification link in their email during
    SSO signup. Validates that the verified email matches the SSO identity,
    stores the verified email in the pipeline's Redis state, and redirects
    back into the SSO pipeline, which handles locking, user creation,
    and login via its normal code path.
    """

    record_analytics = False

    def handle_verified_email(self, request: HttpRequest, verified_email: str) -> HttpResponseBase:
        helper = AuthHelper.get_for_request(request)
        if not helper:
            logger.warning(
                "sso_signup_verification.pipeline_not_found",
                extra={"email_hash": hash_email(verified_email)},
            )
            self._record_failure_metric("pipeline_not_found")
            return self._render_error(
                title="Signup error",
                message="Could not find your signup data. It may have expired. Please restart the signup process.",
            )

        try:
            identity = helper.resolve_identity()
        except PipelineStateExpired:
            logger.warning(
                "sso_signup_verification.state_expired",
                extra={"email_hash": hash_email(verified_email)},
            )
            self._record_failure_metric("state_expired")
            return self._render_error(
                title="Signup error",
                message="Your session has expired. Please restart the signup process.",
            )
        except ProviderMismatch as e:
            return helper._handle_provider_mismatch(
                provider_key=e.actual,
                expected_provider_key=e.expected,
            )
        except IdentityNotValid:
            logger.warning(
                "sso_signup_verification.identity_not_valid",
                extra={"email_hash": hash_email(verified_email)},
            )
            self._record_failure_metric("identity_not_valid")
            return self._render_error(
                title="Signup error",
                message="Something went wrong. Please restart the signup process.",
            )

        if identity["email"].lower() != verified_email.lower():
            logger.warning(
                "sso_signup_verification.email_mismatch",
                extra={
                    "verified_email_hash": hash_email(verified_email),
                    "identity_email_hash": hash_email(identity["email"]),
                },
            )
            self._record_failure_metric("email_mismatch")
            return self._render_error(
                title="Verification error",
                message="Email mismatch. Please restart the signup process.",
            )

        helper.state.verified_email = verified_email
        request.session.pop(PENDING_VERIFICATION_SESSION_KEY, None)
        request.session.pop(PENDING_EXPIRY_TEXT_SESSION_KEY, None)

        email_hash = hash_email(verified_email)
        logger.info(
            "sso_signup_verification.verification_complete",
            extra={"email_hash": email_hash},
        )

        return HttpResponseRedirect(reverse("sentry-auth-sso"))
