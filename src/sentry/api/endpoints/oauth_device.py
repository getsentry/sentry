from __future__ import annotations

import logging
from typing import Literal, TypedDict

from django.conf import settings
from django.db import IntegrityError, router, transaction
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.helpers.oauth_consent import (
    ConsentDecision,
    ConsentDecisionSerializer,
    OAuthConsentPermission,
    OAuthConsentResponse,
    serialize_consent,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.apiapplication import ApiApplicationStatus
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apidevicecode import (
    USER_CODE_GROUP_LENGTH,
    USER_CODE_LENGTH,
    ApiDeviceCode,
    DeviceCodeStatus,
)
from sentry.ratelimits import backend as ratelimiter
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.services.user.service import user_service
from sentry.utils import metrics

logger = logging.getLogger("sentry.oauth")

# Rate limiting for user code verification (RFC 8628 §5.1)
# Limits brute force attempts on the 8-character user code (~34 bits entropy)
USER_CODE_RATE_LIMIT_WINDOW = 60  # seconds
USER_CODE_RATE_LIMIT = 10  # max attempts per window per IP

ERR_INVALID_CODE = "Invalid or expired code. Please check the code and try again."
ERR_EXPIRED_CODE = "This code has expired. Please request a new code from your device."
ERR_RATE_LIMITED = "Too many attempts. Please wait a minute and try again."
ERR_NO_ORG_ACCESS = (
    "This application requires organization-level access. "
    "You must be a member of an organization to authorize this application."
)
ERR_SESSION_EXPIRED = "Your session has expired. Please start over."
ERR_INVALID_REQUEST = "Invalid request. Please start over."
ERR_SELECT_ORG = "Please select an organization."
ERR_INVALID_ORG = "Invalid organization selection."
ERR_NO_ORG_PERMISSION = "You don't have access to the selected organization."


def _normalize_user_code(user_code: str) -> str:
    """
    Normalize a user code to the canonical format "XXXX-XXXX".

    Handles case variations, missing dashes, and extra whitespace.
    """
    normalized = user_code.replace("-", "").upper().strip()
    if len(normalized) == USER_CODE_LENGTH:
        return f"{normalized[:USER_CODE_GROUP_LENGTH]}-{normalized[USER_CODE_GROUP_LENGTH:]}"
    return user_code.upper().strip()


class OAuthDeviceDecision(ConsentDecision):
    user_code: str


class OAuthDeviceDecisionSerializer(ConsentDecisionSerializer[OAuthDeviceDecision]):
    user_code = serializers.CharField(max_length=32)


class OAuthDeviceEntryResponse(TypedDict):
    stage: Literal["codeEntry"]


class OAuthDeviceCompleteResponse(TypedDict):
    stage: Literal["approved", "denied"]


@extend_schema(tags=["Users"])
@control_silo_endpoint
@method_decorator(never_cache, name="dispatch")
class OAuthDeviceEndpoint(Endpoint):
    owner = ApiOwner.FOUNDATIONS
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (OAuthConsentPermission,)
    csrf_protect = True
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={"GET": {RateLimitCategory.IP: RateLimit(limit=20, window=1)}}
    )

    def _error_response(self, error: str) -> Response:
        return Response({"detail": error}, status=400)

    def _get_validated_device_code(
        self,
        *,
        device_code_id: int | None = None,
        user_code: str | None = None,
    ) -> tuple[ApiDeviceCode | None, Response | None]:
        """
        Fetch and validate a device code.

        Args:
            device_code_id: Lookup by ID (for approve/deny after session lookup)
            user_code: Lookup by user code (for initial code entry)

        Returns:
            (device_code, None) on success
            (None, error_response) on failure
        """
        try:
            if device_code_id is not None:
                device_code = ApiDeviceCode.objects.select_related("application").get(
                    id=device_code_id,
                    status=DeviceCodeStatus.PENDING,
                )
            elif user_code is not None:
                formatted_code = _normalize_user_code(user_code)
                device_code = ApiDeviceCode.objects.select_related("application").get(
                    user_code=formatted_code,
                    status=DeviceCodeStatus.PENDING,
                )
            else:
                return None, self._error_response(ERR_INVALID_REQUEST)
        except ApiDeviceCode.DoesNotExist:
            return None, self._error_response(ERR_INVALID_CODE)

        if device_code.is_expired():
            device_code.delete()
            return None, self._error_response(ERR_EXPIRED_CODE)

        if device_code.application.status != ApiApplicationStatus.active:
            device_code.delete()
            return None, self._error_response(ERR_INVALID_CODE)

        return device_code, None

    @extend_schema(
        operation_id="Retrieve OAuth device consent",
        parameters=[OpenApiParameter("user_code", str)],
        responses={
            200: inline_sentry_response_serializer(
                "OAuthDeviceContext",
                OAuthConsentResponse | OAuthDeviceEntryResponse,
            )
        },
    )
    def get(self, request: Request) -> Response:
        # RFC 8628 §3.3.1 allows `verification_uri_complete` to carry the user code.
        # We validate it here and advance to the approval step, but the user must
        # still explicitly approve or deny the request per §3.3 and the
        # confirmation guidance in §5.4.
        user_code = request.GET.get("user_code", "").upper().strip()

        if user_code:
            return self._get_consent(request, user_code)

        return Response({"stage": "codeEntry"})

    def _get_consent(self, request: Request, user_code: str) -> Response:
        """Prepare session-bound consent for a valid user code."""
        # Rate limit user code verification attempts (RFC 8628 §5.1)
        # Note: REMOTE_ADDR is set correctly by SetRemoteAddrFromForwardedFor middleware
        client_ip = request.META.get("REMOTE_ADDR")
        rate_limit_key = f"oauth:device_verify:{client_ip}"
        if ratelimiter.is_limited(
            rate_limit_key, limit=USER_CODE_RATE_LIMIT, window=USER_CODE_RATE_LIMIT_WINDOW
        ):
            logger.warning(
                "oauth.device-verification-rate-limited",
                extra={"ip": client_ip, "user_code_prefix": user_code[:4] if user_code else None},
            )
            return self._error_response(ERR_RATE_LIMITED)

        device_code, error_response = self._get_validated_device_code(user_code=user_code)
        if error_response:
            return error_response

        assert device_code is not None
        application = device_code.application
        scopes = device_code.get_scopes()

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

            if pending_scopes:
                raise NotImplementedError(f"{pending_scopes} scopes did not have descriptions")

        if application.requires_org_level_access:
            organization_options = user_service.get_organizations(
                user_id=request.user.id, only_visible=True
            )
            if not organization_options:
                return self._error_response(ERR_NO_ORG_ACCESS)
        else:
            organization_options = []

        # Store device code ID in session keyed by user_code
        # This allows multiple authorization flows in parallel (different user codes)
        session_key = f"oa2:{device_code.user_code}"
        request.session[session_key] = {
            "device_code_id": device_code.id,
            "user_id": request.user.id,
        }

        return Response(
            serialize_consent(
                application=application,
                scopes=scopes,
                permissions=permissions,
                organization_options=organization_options,
                user_code=device_code.user_code,
            )
        )

    def _deny(self, request: Request, device_code: ApiDeviceCode) -> Response:
        """Claim a pending device request and mark it denied."""
        # Atomically mark as denied only if still pending (prevents race with approve)
        updated = ApiDeviceCode.objects.filter(
            id=device_code.id,
            status=DeviceCodeStatus.PENDING,
        ).update(status=DeviceCodeStatus.DENIED)

        if not updated:
            # Another request already processed this device code
            return self._error_response(ERR_INVALID_CODE)

        metrics.incr("oauth_device.deny", sample_rate=1.0)
        logger.info(
            "oauth.device-code-denied",
            extra={
                "device_code_id": device_code.id,
                "application_id": device_code.application.id,
                "user_id": request.user.id,
            },
        )

        return Response({"stage": "denied"})

    def _approve(
        self,
        request: Request,
        device_code: ApiDeviceCode,
        selected_organization_id: str | None,
    ) -> Response:
        """Claim a pending device request and authorize its scopes."""
        # request.user.id is guaranteed to be int since we only reach here when authenticated
        assert isinstance(request.user.id, int)
        user_id: int = request.user.id

        application = device_code.application

        selected_org_id_int: int | None = None

        if application.requires_org_level_access:
            if not selected_organization_id:
                return self._error_response(ERR_SELECT_ORG)

            user_orgs = user_service.get_organizations(user_id=request.user.id, only_visible=True)
            org_ids = {org.id for org in user_orgs}

            try:
                selected_org_id_int = int(selected_organization_id)
            except (ValueError, TypeError):
                return self._error_response(ERR_INVALID_ORG)

            if selected_org_id_int not in org_ids:
                return self._error_response(ERR_NO_ORG_PERMISSION)

        scopes = device_code.get_scopes()

        # Atomically mark as approved only if still pending (prevents race condition)
        # This must happen first to claim the device code before creating authorization
        updated = ApiDeviceCode.objects.filter(
            id=device_code.id,
            status=DeviceCodeStatus.PENDING,
        ).update(
            status=DeviceCodeStatus.APPROVED,
            user_id=user_id,
            organization_id=selected_org_id_int,
        )
        if not updated:
            # Another request already processed this device code
            return self._error_response(ERR_INVALID_CODE)

        # The try/except must be OUTSIDE the atomic block because PostgreSQL aborts
        # the transaction on IntegrityError, preventing subsequent DB operations.
        try:
            with transaction.atomic(router.db_for_write(ApiAuthorization)):
                ApiAuthorization.objects.create(
                    application=application,
                    user_id=user_id,
                    scope_list=scopes,
                    organization_id=selected_org_id_int,
                )
        except IntegrityError:
            # Authorization already exists, merge in any new scopes
            if scopes:
                auth = ApiAuthorization.objects.get(
                    application=application,
                    user_id=user_id,
                    organization_id=selected_org_id_int,
                )
                auth.scope_list = list(set(auth.scope_list) | set(scopes))
                auth.save(update_fields=["scope_list"])

        metrics.incr(
            "oauth_device.approve",
            sample_rate=1.0,
            tags={"org_level_access": application.requires_org_level_access},
        )
        logger.info(
            "oauth.device-code-approved",
            extra={
                "device_code_id": device_code.id,
                "application_id": device_code.application.id,
                "user_id": user_id,
                "organization_id": selected_org_id_int,
            },
        )

        return Response({"stage": "approved"})

    @extend_schema(
        operation_id="Submit OAuth device consent",
        request=OAuthDeviceDecisionSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "OAuthDeviceComplete", OAuthDeviceCompleteResponse
            )
        },
    )
    def post(self, request: Request) -> Response:
        """Decide the device request prepared by GET in this browser session."""
        serializer = OAuthDeviceDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        op = data["op"]
        selected_organization_id = data["selected_organization_id"]
        user_code = _normalize_user_code(data["user_code"])

        # Look up session data (keyed by user_code for multi-tab support)
        session_key = f"oa2:{user_code}"
        session_data = request.session.get(session_key)

        if not session_data:
            return self._error_response(ERR_SESSION_EXPIRED)

        device_code_id = session_data.get("device_code_id")
        stored_user_id = session_data.get("user_id")

        if not device_code_id or stored_user_id != request.user.id:
            return self._error_response(ERR_SESSION_EXPIRED)

        device_code, error_response = self._get_validated_device_code(device_code_id=device_code_id)
        if error_response:
            return error_response

        assert device_code is not None

        request.session.pop(session_key, None)

        if op == "deny":
            return self._deny(request, device_code)

        return self._approve(request, device_code, selected_organization_id)
