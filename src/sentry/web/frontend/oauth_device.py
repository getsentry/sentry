from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from django.db import IntegrityError, router, transaction
from django.http import HttpRequest
from django.http.response import HttpResponseBase

from sentry.models.apiapplication import ApiApplicationStatus
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apidevicecode import ApiDeviceCode, DeviceCodeStatus
from sentry.ratelimits import backend as ratelimiter
from sentry.users.services.user.service import user_service
from sentry.utils import metrics
from sentry.web.frontend.auth_login import AuthLoginView

logger = logging.getLogger("sentry.oauth")

# Rate limiting for user code verification (RFC 8628 §5.1)
# Limits brute force attempts on the 8-character user code (~34 bits entropy)
USER_CODE_RATE_LIMIT_WINDOW = 60  # seconds
USER_CODE_RATE_LIMIT = 10  # max attempts per window per IP


class OAuthDeviceView(AuthLoginView):
    """
    Device verification page for OAuth 2.0 Device Flow (RFC 8628 §3.3).

    This view handles the user-facing part of the device authorization flow,
    where users enter the user_code displayed by their device and approve
    or deny the authorization request.

    Flow:
    1. GET /oauth/device - Show form to enter user_code (or with ?user_code=XXX)
    2. POST /oauth/device - Verify code and show approval form
    3. POST /oauth/device (op=approve/deny) - Complete verification

    Reference: https://datatracker.ietf.org/doc/html/rfc8628#section-3.3
    """

    auth_required = False

    def get_next_uri(self, request: HttpRequest) -> str:
        return request.get_full_path()

    def respond_login(self, request: HttpRequest, context, **kwargs):
        context["banner"] = "Authorize Device"
        return self.respond("sentry/login.html", context)

    def get(self, request: HttpRequest, **kwargs) -> HttpResponseBase:
        # Check if user_code was provided in query string (verification_uri_complete)
        user_code = request.GET.get("user_code", "").upper().strip()

        if not request.user.is_authenticated:
            # Store user_code in session for after login
            if user_code:
                request.session["device_user_code"] = user_code
            return super().get(request, **kwargs)

        # If we have a user_code, try to look it up and show the approval form
        if user_code:
            return self._show_approval_form(request, user_code)

        # Check if we stored a user_code in session during login
        stored_code = request.session.pop("device_user_code", None)
        if stored_code:
            return self._show_approval_form(request, stored_code)

        # Otherwise, show the user_code entry form
        context = self.get_default_context(request) | {
            "user": request.user,
        }
        return self.respond("sentry/oauth-device.html", context)

    def _get_client_ip(self, request: HttpRequest) -> str:
        """Get client IP for rate limiting."""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "unknown")

    def _show_approval_form(self, request: HttpRequest, user_code: str) -> HttpResponseBase:
        """Show the approval form for a valid user code."""
        # Rate limit user code verification attempts (RFC 8628 §5.1)
        client_ip = self._get_client_ip(request)
        rate_limit_key = f"oauth:device_verify:{client_ip}"
        if ratelimiter.is_limited(
            rate_limit_key, limit=USER_CODE_RATE_LIMIT, window=USER_CODE_RATE_LIMIT_WINDOW
        ):
            logger.warning(
                "oauth.device-verification-rate-limited",
                extra={"ip": client_ip, "user_code_prefix": user_code[:4] if user_code else None},
            )
            context = self.get_default_context(request) | {
                "user": request.user,
                "error": "Too many attempts. Please wait a minute and try again.",
            }
            return self.respond("sentry/oauth-device.html", context)

        # Normalize user code: uppercase, remove dashes, then re-add dash in correct position
        normalized_code = user_code.replace("-", "").upper()
        if len(normalized_code) == 8:
            # Format as "XXXX-XXXX" to match stored format
            formatted_code = f"{normalized_code[:4]}-{normalized_code[4:]}"
        else:
            formatted_code = user_code.upper()

        try:
            # user_code is unique, so .get() is safe
            device_code = ApiDeviceCode.objects.select_related("application").get(
                user_code=formatted_code,
                status=DeviceCodeStatus.PENDING,
            )
        except ApiDeviceCode.DoesNotExist:
            context = self.get_default_context(request) | {
                "user": request.user,
                "error": "Invalid or expired code. Please check the code and try again.",
            }
            return self.respond("sentry/oauth-device.html", context)

        # Check if expired
        if device_code.is_expired():
            device_code.delete()
            context = self.get_default_context(request) | {
                "user": request.user,
                "error": "This code has expired. Please request a new code from your device.",
            }
            return self.respond("sentry/oauth-device.html", context)

        application = device_code.application

        # Check if application is still active (treat inactive as if code doesn't exist)
        if application.status != ApiApplicationStatus.active:
            device_code.delete()
            context = self.get_default_context(request) | {
                "user": request.user,
                "error": "Invalid or expired code. Please check the code and try again.",
            }
            return self.respond("sentry/oauth-device.html", context)

        scopes = device_code.get_scopes()

        # Build permissions list (same logic as oauth_authorize)
        permissions = []
        if scopes:
            pending_scopes = set(scopes)
            matched_sets = set()
            for scope_set in settings.SENTRY_SCOPE_SETS:
                for scope, description in scope_set:
                    if scope_set in matched_sets and scope in pending_scopes:
                        pending_scopes.remove(scope)
                    elif scope in pending_scopes:
                        permissions.append(description)
                        matched_sets.add(scope_set)
                        pending_scopes.remove(scope)

        # Get organization options if needed
        if application.requires_org_level_access:
            organization_options = user_service.get_organizations(
                user_id=request.user.id, only_visible=True
            )
            if not organization_options:
                context = self.get_default_context(request) | {
                    "user": request.user,
                    "error": "This authorization flow is only available for users who are members of an organization.",
                }
                return self.respond("sentry/oauth-device.html", context)
        else:
            organization_options = []

        # Store device code ID in session for the POST
        request.session["device_code_id"] = device_code.id
        request.session["device_user_id"] = request.user.id

        context = self.get_default_context(request) | {
            "user": request.user,
            "application": application,
            "scopes": scopes,
            "permissions": permissions,
            "organization_options": organization_options,
            "user_code": device_code.user_code,
        }
        return self.respond("sentry/oauth-device-authorize.html", context)

    def _logged_out_post(self, request: HttpRequest, **kwargs: Any) -> HttpResponseBase:
        """Handle POST when user is not logged in."""
        response = super().post(request, **kwargs)
        if request.user.is_authenticated:
            # Regenerate session to prevent session fixation
            request.session.cycle_key()
        return response

    def post(self, request: HttpRequest, **kwargs) -> HttpResponseBase:
        if not request.user.is_authenticated:
            return self._logged_out_post(request, **kwargs)

        # Check if this is a user_code submission (from the entry form)
        user_code = request.POST.get("user_code", "").upper().strip()
        if user_code:
            return self._show_approval_form(request, user_code)

        # Otherwise, this is an approve/deny action
        op = request.POST.get("op")
        if op not in ("approve", "deny"):
            context = self.get_default_context(request) | {
                "user": request.user,
                "error": "Invalid operation.",
            }
            return self.respond("sentry/oauth-device.html", context)

        # Get the device code from session
        device_code_id = request.session.get("device_code_id")
        stored_user_id = request.session.get("device_user_id")

        if not device_code_id or stored_user_id != request.user.id:
            context = self.get_default_context(request) | {
                "user": request.user,
                "error": "Session expired. Please start over.",
            }
            return self.respond("sentry/oauth-device.html", context)

        try:
            device_code = ApiDeviceCode.objects.select_related("application").get(
                id=device_code_id,
                status=DeviceCodeStatus.PENDING,
            )
        except ApiDeviceCode.DoesNotExist:
            context = self.get_default_context(request) | {
                "user": request.user,
                "error": "This code is no longer valid.",
            }
            return self.respond("sentry/oauth-device.html", context)

        # Check if expired
        if device_code.is_expired():
            device_code.delete()
            context = self.get_default_context(request) | {
                "user": request.user,
                "error": "This code has expired.",
            }
            return self.respond("sentry/oauth-device.html", context)

        # Check if application is still active (treat inactive as if code doesn't exist)
        if device_code.application.status != ApiApplicationStatus.active:
            device_code.delete()
            context = self.get_default_context(request) | {
                "user": request.user,
                "error": "This code is no longer valid.",
            }
            return self.respond("sentry/oauth-device.html", context)

        # Clear session data
        request.session.pop("device_code_id", None)
        request.session.pop("device_user_id", None)

        if op == "deny":
            device_code.status = DeviceCodeStatus.DENIED
            device_code.save(update_fields=["status"])

            metrics.incr("oauth_device.deny", sample_rate=1.0)
            logger.info(
                "oauth.device-code-denied",
                extra={
                    "device_code_id": device_code.id,
                    "application_id": device_code.application_id,
                    "user_id": request.user.id,
                },
            )

            context = self.get_default_context(request) | {
                "user": request.user,
                "message": "Authorization denied. You can close this window.",
            }
            return self.respond("sentry/oauth-device-complete.html", context)

        # op == "approve"
        application = device_code.application

        # Handle organization selection for org-level access apps
        selected_organization_id = request.POST.get("selected_organization_id")
        selected_org_id_int: int | None = None

        if application.requires_org_level_access:
            if not selected_organization_id:
                context = self.get_default_context(request) | {
                    "user": request.user,
                    "error": "Please select an organization.",
                }
                return self.respond("sentry/oauth-device.html", context)

            # Validate user has access to the selected organization
            user_orgs = user_service.get_organizations(user_id=request.user.id, only_visible=True)
            org_ids = {org.id for org in user_orgs}

            try:
                selected_org_id_int = int(selected_organization_id)
            except (ValueError, TypeError):
                context = self.get_default_context(request) | {
                    "user": request.user,
                    "error": "Invalid organization selection.",
                }
                return self.respond("sentry/oauth-device.html", context)

            if selected_org_id_int not in org_ids:
                context = self.get_default_context(request) | {
                    "user": request.user,
                    "error": "You don't have access to the selected organization.",
                }
                return self.respond("sentry/oauth-device.html", context)

            device_code.organization_id = selected_org_id_int

        # Create or update ApiAuthorization record (same pattern as oauth_authorize)
        # This tracks that the user has authorized this application
        scopes = device_code.get_scopes()
        try:
            with transaction.atomic(router.db_for_write(ApiAuthorization)):
                ApiAuthorization.objects.create(
                    application=application,
                    user_id=request.user.id,
                    scope_list=scopes,
                    organization_id=selected_org_id_int,
                )
        except IntegrityError:
            # Authorization already exists, merge in any new scopes
            if scopes:
                auth = ApiAuthorization.objects.get(
                    application=application,
                    user_id=request.user.id,
                    organization_id=selected_org_id_int,
                )
                auth.scope_list = list(set(auth.scope_list) | set(scopes))
                auth.save(update_fields=["scope_list"])

        # Mark as approved
        device_code.status = DeviceCodeStatus.APPROVED
        device_code.user_id = request.user.id
        device_code.save(update_fields=["status", "user_id", "organization_id"])

        metrics.incr(
            "oauth_device.approve",
            sample_rate=1.0,
            tags={"org_level_access": application.requires_org_level_access},
        )
        logger.info(
            "oauth.device-code-approved",
            extra={
                "device_code_id": device_code.id,
                "application_id": device_code.application_id,
                "user_id": request.user.id,
                "organization_id": device_code.organization_id,
            },
        )

        context = self.get_default_context(request) | {
            "user": request.user,
            "message": f"Authorization approved! Your device should now be connected to {application.name}. You can close this window.",
            "application": application,
        }
        return self.respond("sentry/oauth-device-complete.html", context)
