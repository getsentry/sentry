from __future__ import annotations

from django.contrib.auth.views import redirect_to_login
from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseBase
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache

from sentry.api.helpers.oauth_consent import (
    InvalidOrganizationSelection,
    get_organization_options,
    get_permission_descriptions,
)
from sentry.api.helpers.oauth_device import (
    InvalidDeviceRequest,
    complete_device_request,
    get_device_request,
    get_prepared_device_request,
    normalize_user_code,
    prepare_device_consent,
)
from sentry.models.apidevicecode import (
    ApiDeviceCode,
)
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import auth
from sentry.web.client_config import get_client_config
from sentry.web.frontend.base import BaseView, control_silo_view

# Standardized error messages
ERR_NO_ORG_ACCESS = (
    "This application requires organization-level access. "
    "You must be a member of an organization to authorize this application."
)
ERR_INVALID_REQUEST = "Invalid request. Please start over."
ERR_INVALID_OP = "Invalid operation."


@control_silo_view
@method_decorator(never_cache, name="dispatch")
class OAuthDeviceView(BaseView):
    """
    Device verification page for OAuth 2.0 Device Flow (RFC 8628 §3.3).

    Purpose
    - Handles the user-facing verification step where the user enters the
      `user_code` shown on their device and then explicitly approves or denies
      the authorization request (RFC 8628 §3.3).
    - Supports `verification_uri_complete` by accepting `user_code` on GET and,
      after validation, advancing to the explicit approve/deny step. This keeps
      the user interaction at the verification endpoint described in RFC 8628
      §3.3/§3.3.1 while still requiring a second confirmation step and aligning
      with the phishing mitigation guidance in §5.4.

    Flow:
    1. GET /oauth/device - Show the entry form, or validate `user_code` from
       `verification_uri_complete` (`?user_code=...`) and show the approval form
    2. POST /oauth/device - Validate the code and show the approval form
    3. POST /oauth/device (op=approve/deny) - Complete verification

    References:
    - Verification endpoint: https://datatracker.ietf.org/doc/html/rfc8628#section-3.3
    - Non-textual verification URI optimization:
      https://datatracker.ietf.org/doc/html/rfc8628#section-3.3.1
    - Remote phishing mitigation: https://datatracker.ietf.org/doc/html/rfc8628#section-5.4
    """

    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={"GET": {RateLimitCategory.IP: RateLimit(limit=20, window=1)}}
    )

    def handle_auth_required(self, request: HttpRequest, **kwargs) -> HttpResponse:
        auth.initiate_login(request, next_url=request.get_full_path())
        return redirect_to_login(request.get_full_path(), reverse("sentry-login"))

    def get_context_data(self, request: HttpRequest, **kwargs) -> dict:
        return {
            **super().get_context_data(request, **kwargs),
            "react_config": get_client_config(request, self.active_organization),
        }

    def _error_response(self, request: HttpRequest, error: str) -> HttpResponseBase:
        """Return an error response on the device code entry page."""
        context = {
            "user": request.user,
            "error": error,
        }
        return self.respond("sentry/oauth-device.html", context)

    def get(self, request: HttpRequest, **kwargs) -> HttpResponseBase:
        # RFC 8628 §3.3.1 allows `verification_uri_complete` to carry the user code.
        # We validate it here and advance to the approval step, but the user must
        # still explicitly approve or deny the request per §3.3 and the
        # confirmation guidance in §5.4.
        user_code = request.GET.get("user_code", "").upper().strip()

        if user_code:
            return self._show_approval_form(request, user_code)

        context = {
            "user": request.user,
        }
        return self.respond("sentry/oauth-device.html", context)

    def _show_approval_form(self, request: HttpRequest, user_code: str) -> HttpResponseBase:
        """Show the approval form for a valid user code."""
        try:
            device_code = get_device_request(user_code, request.META.get("REMOTE_ADDR"))
        except InvalidDeviceRequest as exc:
            return self._error_response(request, exc.public_message)

        application = device_code.application
        scopes = device_code.get_scopes()

        assert isinstance(request.user.id, int)
        permissions = get_permission_descriptions(scopes)
        organization_options = get_organization_options(application, request.user.id)
        if application.requires_org_level_access and not organization_options:
            return self._error_response(request, ERR_NO_ORG_ACCESS)

        prepare_device_consent(request.session, device_code, request.user.id)

        context = {
            "user": request.user,
            "application": application,
            "scopes": scopes,
            "permissions": permissions,
            "organization_options": organization_options,
            "user_code": device_code.user_code,
        }
        return self.respond("sentry/oauth-device-authorize.html", context)

    def _handle_deny(self, request: HttpRequest, device_code: ApiDeviceCode) -> HttpResponseBase:
        """Handle deny action for a device code."""
        assert isinstance(request.user.id, int)
        try:
            complete_device_request(device_code.id, request.user.id, "deny")
        except InvalidDeviceRequest as exc:
            return self._error_response(request, exc.public_message)

        context = {
            "user": request.user,
            "message": "Authorization denied. You can close this window.",
        }
        return self.respond("sentry/oauth-device-complete.html", context)

    def _handle_approve(self, request: HttpRequest, device_code: ApiDeviceCode) -> HttpResponseBase:
        """Handle approve action for a device code."""
        assert isinstance(request.user.id, int)
        application = device_code.application
        try:
            complete_device_request(
                device_code.id,
                request.user.id,
                "approve",
                request.POST.get("selected_organization_id"),
            )
        except InvalidOrganizationSelection as exc:
            return self._error_response(request, exc.public_message)
        except InvalidDeviceRequest as exc:
            return self._error_response(request, exc.public_message)

        context = {
            "user": request.user,
            "message": f"Authorization approved! Your device should now be connected to {application.name}. You can close this window.",
            "application": application,
        }
        return self.respond("sentry/oauth-device-complete.html", context)

    def post(self, request: HttpRequest, **kwargs) -> HttpResponseBase:
        # Check if this is an approve/deny action (from the approval form)
        # Must check op FIRST since approval form also includes user_code as hidden field
        op = request.POST.get("op")
        user_code = request.POST.get("user_code", "")

        if op:
            return self._handle_op(request, op, user_code)
        elif user_code:
            # User code submission from entry form - show approval form
            return self._show_approval_form(request, user_code)
        else:
            return self._error_response(request, ERR_INVALID_REQUEST)

    def _handle_op(self, request: HttpRequest, op: str, user_code: str) -> HttpResponseBase:
        """Handle approve/deny operation from the approval form."""
        if op not in ("approve", "deny"):
            return self._error_response(request, ERR_INVALID_OP)

        user_code = normalize_user_code(user_code)
        if not user_code:
            return self._error_response(request, ERR_INVALID_REQUEST)

        assert isinstance(request.user.id, int)
        try:
            device_code = get_prepared_device_request(request.session, user_code, request.user.id)
        except InvalidDeviceRequest as exc:
            return self._error_response(request, exc.public_message)

        request.session.pop(f"oa2:{user_code}", None)
        if op == "deny":
            return self._handle_deny(request, device_code)

        return self._handle_approve(request, device_code)
