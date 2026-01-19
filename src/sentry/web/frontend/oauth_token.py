from __future__ import annotations

import base64
import hashlib
import logging
import uuid
from datetime import datetime
from typing import Literal, NotRequired, TypedDict

from django.db import router, transaction
from django.http import HttpRequest, HttpResponse
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.generic.base import View
from rest_framework.request import Request

from sentry import options
from sentry.locks import locks
from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus
from sentry.models.apidevicecode import DEFAULT_INTERVAL, ApiDeviceCode, DeviceCodeStatus
from sentry.models.apigrant import ApiGrant, ExpiredGrantError, InvalidGrantError
from sentry.models.apitoken import ApiToken
from sentry.ratelimits import backend as ratelimiter
from sentry.sentry_apps.token_exchange.util import GrantTypes
from sentry.silo.safety import unguarded_write
from sentry.utils import json, metrics
from sentry.utils.locking import UnableToAcquireLock
from sentry.web.frontend.base import control_silo_view
from sentry.web.frontend.openidtoken import OpenIDToken

logger = logging.getLogger("sentry.oauth")

# Max allowed length (in bytes/characters) of the Base64 section of a Basic
# Authorization header to prevent excessive memory allocation on decode.
# Client credentials (client_id:client_secret) should be small; 4KB is generous.
MAX_BASIC_AUTH_B64_LEN = 4096


class _TokenInformationUser(TypedDict):
    id: str
    name: str
    email: str


class _TokenInformation(TypedDict):
    access_token: str
    refresh_token: str | None
    expires_in: int | None
    expires_at: datetime | None
    token_type: Literal["Bearer"]
    scope: str
    user: _TokenInformationUser
    id_token: NotRequired[OpenIDToken]
    organization_id: NotRequired[str]


@control_silo_view
class OAuthTokenView(View):
    # Token responses must not be cached per RFC 6749 §5.1/§5.2. We apply
    # never_cache at dispatch so every response from this endpoint is marked
    # appropriately without repeating headers across handlers.
    @csrf_exempt
    @method_decorator(never_cache)
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    # Note: the reason parameter is for internal use only
    def error(self, request: HttpRequest, name, reason=None, status=400):
        client_id = request.POST.get("client_id")

        logger.error(
            "oauth.token-error",
            extra={
                "error_name": name,
                "status": status,
                "client_id": client_id,
                "reason": reason,
            },
        )
        resp = HttpResponse(
            json.dumps({"error": name}), content_type="application/json", status=status
        )
        # RFC 6749 §5.2 invalid_client requires WWW-Authenticate header
        if name == "invalid_client":
            resp["WWW-Authenticate"] = 'Basic realm="oauth"'
        return resp

    def post(self, request: Request) -> HttpResponse:
        """OAuth 2.0 token endpoint (RFC 6749 §3.2).

        Purpose
        - Exchanges an authorization code for tokens, or uses a refresh token to
          obtain a new access token, or exchanges a device code for tokens.

        Supported grant types
        - `authorization_code` (RFC 6749 §4.1): requires `code` and, if bound,
          a matching `redirect_uri` (§4.1.3). If `openid` scope was granted and
          signing is configured, an `id_token` (OIDC Core 1.0) is included.
        - `refresh_token` (RFC 6749 §6): requires `refresh_token`. Supplying `scope`
          is not supported here and returns `invalid_request`.
        - `urn:ietf:params:oauth:grant-type:device_code` (RFC 8628 §3.4): requires
          `device_code`. Used by headless clients to poll for authorization.

        Client authentication
        - Either Authorization header (Basic) or form fields `client_id`/`client_secret`
          (RFC 6749 §2.3.1). Only one method may be used per request.
        - For device_code grant: supports public clients per RFC 8628 §5.6, which only
          require `client_id`. If `client_secret` is provided, it will be validated.

        Request format
        - Requests are `application/x-www-form-urlencoded` as defined in RFC 6749 §3.2.

        Responses
        - Success (RFC 6749 §5.1): 200 JSON with `access_token`, `refresh_token`,
          `expires_in`/`expires_at`, `token_type` (Bearer), `scope`, `user`, and
          optionally `id_token` and `organization_id`.
        - Errors (RFC 6749 §5.2): 400 JSON for `invalid_request`, `invalid_grant`,
          `unsupported_grant_type`; 401 JSON for `invalid_client` (with
          `WWW-Authenticate: Basic realm="oauth"`).
        - Device flow errors (RFC 8628 §3.5): `authorization_pending`, `slow_down`,
          `expired_token`, `access_denied`.
        """
        grant_type = request.POST.get("grant_type")

        # Validate grant_type first (needed to determine auth requirements)
        if not grant_type:
            return self.error(request=request, name="invalid_request", reason="missing grant_type")
        if grant_type not in [
            GrantTypes.AUTHORIZATION,
            GrantTypes.REFRESH,
            GrantTypes.DEVICE_CODE,
        ]:
            return self.error(request=request, name="unsupported_grant_type")

        # Determine client credentials from header or body (mutually exclusive).
        (client_id, client_secret), cred_error = self._extract_basic_auth_credentials(request)
        if cred_error is not None:
            return cred_error

        metrics.incr(
            "oauth_token.post.start",
            sample_rate=1.0,
            tags={
                "client_id_exists": bool(client_id),
                "client_secret_exists": bool(client_secret),
                "grant_type": grant_type,
            },
        )

        # Client authentication logic:
        # - Public clients (RFC 6749 §2.1): Only provide client_id, no secret
        # - Confidential clients: Provide client_id + client_secret
        #
        # Public clients are supported for:
        # - Device flow (RFC 8628 §5.6)
        # - Refresh token with rotation (RFC 9700 §4.14.2)
        #
        # We first look up the application by client_id to determine if it's public,
        # then validate the secret only if the application is confidential.

        if not client_id:
            return self.error(
                request=request,
                name="invalid_client",
                reason="missing client_id",
                status=401,
            )

        try:
            application = ApiApplication.objects.get(client_id=client_id)
        except ApiApplication.DoesNotExist:
            metrics.incr("oauth_token.post.invalid", sample_rate=1.0)
            logger.warning("Invalid client_id", extra={"client_id": client_id})
            return self.error(
                request=request,
                name="invalid_client",
                reason="invalid client_id",
                status=401,
            )

        # Determine if this is a public or confidential client
        is_public_client = application.is_public

        # For confidential clients, validate the secret
        if not is_public_client:
            if not client_secret:
                # Confidential client must provide secret
                return self.error(
                    request=request,
                    name="invalid_client",
                    reason="missing client_secret",
                    status=401,
                )
            if application.client_secret != client_secret:
                metrics.incr("oauth_token.post.invalid", sample_rate=1.0)
                logger.warning(
                    "Invalid client_secret",
                    extra={"client_id": client_id},
                )
                return self.error(
                    request=request,
                    name="invalid_client",
                    reason="invalid client_secret",
                    status=401,
                )
        else:
            # Public client - log if they provided a secret (shouldn't happen)
            if client_secret:
                logger.info(
                    "Public client provided client_secret (ignored)",
                    extra={"client_id": client_id},
                )

        # Public clients can only use certain grant types
        if is_public_client and grant_type == GrantTypes.AUTHORIZATION:
            # Authorization code for public clients requires PKCE (validated in from_grant)
            # This is allowed - PKCE provides the security
            pass
        elif is_public_client and grant_type not in [
            GrantTypes.DEVICE_CODE,
            GrantTypes.REFRESH,
        ]:
            return self.error(
                request=request,
                name="unauthorized_client",
                reason="public clients cannot use this grant type",
            )

        # Check application status separately from credential validation.
        # This preserves metric clarity and provides consistent error handling.
        if application.status != ApiApplicationStatus.active:
            metrics.incr(
                "oauth_token.post.inactive_application",
                sample_rate=1.0,
            )
            logger.warning(
                "Token request for inactive application",
                extra={"client_id": client_id, "application_id": application.id},
            )
            # For authorization_code, invalidate the grant per RFC 6749 §10.5
            if grant_type == GrantTypes.AUTHORIZATION:
                code = request.POST.get("code")
                if code:
                    # Use unguarded_write because deleting the grant triggers SET_NULL on
                    # SentryAppInstallation.api_grant, which is a cross-model write
                    with unguarded_write(using=router.db_for_write(ApiGrant)):
                        ApiGrant.objects.filter(application=application, code=code).delete()
            # For device_code, invalidate the device code
            elif grant_type == GrantTypes.DEVICE_CODE:
                device_code_value = request.POST.get("device_code")
                if device_code_value:
                    ApiDeviceCode.objects.filter(
                        application=application, device_code=device_code_value
                    ).delete()
            # Use invalid_grant per RFC 6749 §5.2: grants/tokens are effectively "revoked"
            # when the application is deactivated. invalid_client would be incorrect here
            # since client authentication succeeded (we verified the credentials).
            return self.error(
                request=request,
                name="invalid_grant",
                reason="application not active",
            )

        # Defense-in-depth: verify the application's client_id matches the request.
        # This should always be true given the query above, but protects against
        # potential logic bugs or database inconsistencies.
        if application.client_id != client_id:
            logger.error(
                "Application client_id mismatch",
                extra={
                    "requested_client_id": client_id,
                    "application_client_id": application.client_id,
                    "application_id": application.id,
                },
            )
            return self.error(
                request=request,
                name="invalid_client",
                reason="client_id mismatch",
                status=401,
            )

        if grant_type == GrantTypes.AUTHORIZATION:
            token_data = self.get_access_tokens(request=request, application=application)
        elif grant_type == GrantTypes.DEVICE_CODE:
            return self.handle_device_code_grant(request=request, application=application)
        elif grant_type == GrantTypes.REFRESH:
            # Public clients use token rotation (RFC 9700 §4.14.2)
            if is_public_client:
                return self.handle_public_client_refresh(request=request, application=application)
            else:
                token_data = self.get_refresh_token(request=request, application=application)
        else:
            # Should not reach here due to earlier grant_type validation
            return self.error(request=request, name="unsupported_grant_type")
        if "error" in token_data:
            return self.error(
                request=request,
                name=token_data["error"],
                reason=token_data["reason"] if "reason" in token_data else None,
            )
        return self.process_token_details(
            token=token_data["token"],
            id_token=token_data["id_token"] if "id_token" in token_data else None,
        )

    def _extract_basic_auth_credentials(
        self, request: Request
    ) -> tuple[tuple[str | None, str | None], HttpResponse | None]:
        """
        Extract client credentials from the request.

        Supported mechanisms (mutually exclusive):
        - HTTP Authorization header with the Basic scheme
          (RFC 6749 §2.3.1; Basic syntax per RFC 7617: base64(client_id:client_secret)).
        - Form body fields: `client_id` and `client_secret` (RFC 6749 §2.3.1).

        Returns ((client_id, client_secret), error_response).
        - If both mechanisms are present, returns `invalid_request` (client MUST NOT
          use more than one authentication method; RFC 6749 §2.3).
        - If the Basic header is malformed, returns `invalid_client` with 401
          (error semantics per RFC 6749 §5.2; Basic auth per §2.3.1).
        - If neither mechanism is present, returns (None, None), None and the
          caller enforces `invalid_client` as appropriate (RFC 6749 §5.2).

        Note: This helper enforces a conservative upper bound on Basic header
        payload size for robustness; this limit is an implementation detail and
        not dictated by the RFCs.
        """
        # Check for Basic auth header first
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        has_auth_header = isinstance(auth_header, str) and bool(auth_header)

        body_client_id = request.POST.get("client_id")
        body_client_secret = request.POST.get("client_secret")
        has_body_credentials = bool(body_client_id) or bool(body_client_secret)

        # If both mechanisms are present, this is an invalid request per spec.
        if has_auth_header:
            scheme, _, param = auth_header.partition(" ")
            if scheme and scheme.lower() == "basic" and param:
                if has_body_credentials:
                    logger.info(
                        "oauth.basic-and-body-credentials",
                        extra={
                            "client_id": body_client_id,
                            "reason": "conflict",
                        },
                    )
                    return (None, None), self.error(
                        request=request,
                        name="invalid_request",
                        reason="credential conflict",
                    )

                # Enforce a reasonable upper bound on the Base64 payload to
                # avoid excessive memory use on decode.
                b64 = param.strip()
                if len(b64) > MAX_BASIC_AUTH_B64_LEN:
                    logger.warning("Invalid Basic auth header: too long", extra={"client_id": None})
                    return (None, None), self.error(
                        request=request,
                        name="invalid_client",
                        reason="invalid basic auth (too long)",
                        status=401,
                    )
                try:
                    decoded = base64.b64decode(b64.encode("ascii"), validate=True).decode("utf-8")
                    # format: client_id:client_secret (client_secret may be empty)
                    if ":" not in decoded:
                        raise ValueError("missing colon in basic credentials")
                    client_id, client_secret = decoded.split(":", 1)
                    return (client_id, client_secret), None
                except Exception:
                    logger.warning("Invalid Basic auth header", extra={"client_id": None})
                    return (None, None), self.error(
                        request=request,
                        name="invalid_client",
                        reason="invalid basic auth",
                        status=401,
                    )

        # No usable Basic header; fall back to body credentials if provided.
        if has_body_credentials:
            return (body_client_id, body_client_secret), None

        # Neither header nor body provided credentials.
        return (None, None), None

    def get_access_tokens(self, request: Request, application: ApiApplication) -> dict:
        code = request.POST.get("code")
        try:
            grant = ApiGrant.objects.get(application=application, code=code)
        except ApiGrant.DoesNotExist:
            return {"error": "invalid_grant", "reason": "invalid grant"}

        # Save data needed for OpenID before from_grant deletes the grant
        grant_has_openid = grant.has_scope("openid")
        grant_user_id = grant.user_id

        try:
            api_token = ApiToken.from_grant(
                grant=grant,
                redirect_uri=request.POST.get("redirect_uri", ""),
                code_verifier=request.POST.get("code_verifier"),
            )
        except InvalidGrantError as e:
            return {
                "error": "invalid_grant",
                "reason": str(e) if str(e) else "invalid grant",
            }
        except ExpiredGrantError as e:
            return {
                "error": "invalid_grant",
                "reason": str(e) if str(e) else "grant expired",
            }

        token_data = {"token": api_token}

        # OpenID token generation (stays in endpoint)
        if grant_has_openid and options.get("codecov.signing_secret"):
            open_id_token = OpenIDToken(
                application.client_id,
                grant_user_id,
                options.get("codecov.signing_secret"),
                nonce=request.POST.get("nonce"),
            )
            # Use api_token.user instead of grant since grant is deleted
            from types import SimpleNamespace

            grant_data = SimpleNamespace(
                user_id=grant_user_id,
                has_scope=lambda s: s in api_token.get_scopes(),
                user=api_token.user,
            )
            token_data["id_token"] = open_id_token.get_signed_id_token(grant=grant_data)

        return token_data

    def get_refresh_token(self, request: Request, application: ApiApplication) -> dict:
        refresh_token_code = request.POST.get("refresh_token")
        scope = request.POST.get("scope")

        if not refresh_token_code:
            return {"error": "invalid_request"}

        # TODO(dcramer): support scope
        if scope:
            return {"error": "invalid_request"}

        try:
            refresh_token = ApiToken.objects.get(
                application=application, refresh_token=refresh_token_code
            )
        except ApiToken.DoesNotExist:
            return {"error": "invalid_grant", "reason": "invalid request"}
        refresh_token.refresh()

        return {"token": refresh_token}

    def handle_device_code_grant(
        self, request: Request, application: ApiApplication
    ) -> HttpResponse:
        """
        Handle device code grant type (RFC 8628 §3.4).

        This is used by headless clients to poll for authorization status after
        initiating a device authorization flow.

        Returns:
        - On success (approved): Access token response
        - authorization_pending: User hasn't completed authorization yet
        - slow_down: Client is polling too fast
        - expired_token: Device code has expired
        - access_denied: User denied the authorization
        """
        device_code_value = request.POST.get("device_code")

        if not device_code_value:
            return self.error(
                request=request,
                name="invalid_request",
                reason="missing device_code",
            )

        # Rate limit polling per device_code (RFC 8628 §3.5)
        # Allow 1 request per interval (default 5 seconds) = 12 requests/minute
        rate_limit_key = f"oauth:device_poll:{device_code_value}"
        if ratelimiter.is_limited(rate_limit_key, limit=1, window=DEFAULT_INTERVAL):
            return self.error(
                request=request,
                name="slow_down",
                reason="polling too fast",
            )

        # Look up the device code
        try:
            device_code = ApiDeviceCode.objects.get(
                device_code=device_code_value,
                application=application,
            )
        except ApiDeviceCode.DoesNotExist:
            return self.error(
                request=request,
                name="invalid_grant",
                reason="invalid device_code",
            )

        # Check if expired (RFC 8628 §3.5)
        if device_code.is_expired():
            device_code.delete()
            return self.error(
                request=request,
                name="expired_token",
                reason="device code expired",
            )

        # Check authorization status (RFC 8628 §3.5)
        if device_code.status == DeviceCodeStatus.PENDING:
            # User hasn't completed authorization yet
            return self.error(
                request=request,
                name="authorization_pending",
                reason="user authorization pending",
            )
        elif device_code.status == DeviceCodeStatus.DENIED:
            # User denied the authorization
            device_code.delete()
            return self.error(
                request=request,
                name="access_denied",
                reason="user denied authorization",
            )
        elif device_code.status == DeviceCodeStatus.APPROVED:
            # Use locking to prevent race condition where multiple requests
            # could create tokens for the same device code (TOCTOU)
            lock = locks.get(
                ApiDeviceCode.get_lock_key(device_code.id),
                duration=10,
                name="api_device_code",
            )

            try:
                lock_context = lock.acquire()
            except UnableToAcquireLock:
                # Another request is currently processing this device code
                return self.error(
                    request=request,
                    name="invalid_grant",
                    reason="device code already in use",
                )

            with lock_context:
                # Re-fetch inside lock to prevent TOCTOU race condition
                try:
                    device_code = ApiDeviceCode.objects.get(id=device_code.id)
                except ApiDeviceCode.DoesNotExist:
                    # Another request already processed this device code
                    return self.error(
                        request=request,
                        name="invalid_grant",
                        reason="invalid device_code",
                    )

                # Re-check status inside lock
                if device_code.status != DeviceCodeStatus.APPROVED:
                    return self.error(
                        request=request,
                        name="invalid_grant",
                        reason="device code in invalid state",
                    )

                # Re-check expiration inside lock (could have expired during lock wait)
                if device_code.is_expired():
                    device_code.delete()
                    return self.error(
                        request=request,
                        name="expired_token",
                        reason="device code expired",
                    )

                # User approved - issue tokens
                if device_code.user is None:
                    # This shouldn't happen, but handle it gracefully
                    logger.error(
                        "Device code approved but no user set",
                        extra={
                            "device_code_id": device_code.id,
                            "application_id": application.id,
                        },
                    )
                    device_code.delete()
                    return self.error(
                        request=request,
                        name="invalid_grant",
                        reason="device code in invalid state",
                    )

                # Use a transaction to ensure token creation and device code deletion
                # are atomic. This prevents duplicate tokens if delete fails after
                # token creation succeeds.
                with transaction.atomic(router.db_for_write(ApiToken)):
                    # Create the access token with a token family for rotation tracking.
                    # Public clients (device flow) use refresh token rotation (RFC 9700 §4.14.2),
                    # so we initialize the family here to enable replay detection.
                    token = ApiToken.objects.create(
                        application=application,
                        user_id=device_code.user.id,
                        scope_list=device_code.scope_list,
                        scoping_organization_id=device_code.organization_id,
                        token_family_id=uuid.uuid4(),
                    )

                    # Delete the device code (one-time use)
                    device_code.delete()

                metrics.incr("oauth_device.token_exchange", sample_rate=1.0)
                logger.info(
                    "oauth.device-code-exchanged",
                    extra={
                        "device_code_id": device_code.id,
                        "application_id": application.id,
                        "user_id": device_code.user.id,
                        "token_id": token.id,
                    },
                )

            return self.process_token_details(token=token)

        # Unknown status - shouldn't happen
        logger.error(
            "Device code has unknown status",
            extra={
                "device_code_id": device_code.id,
                "status": device_code.status,
            },
        )
        device_code.delete()
        return self.error(
            request=request,
            name="invalid_grant",
            reason="device code in invalid state",
        )

    def process_token_details(
        self, token: ApiToken, id_token: OpenIDToken | None = None
    ) -> HttpResponse:
        token_information: _TokenInformation = {
            "access_token": token.token,
            "refresh_token": token.refresh_token,
            "expires_in": (
                int((token.expires_at - timezone.now()).total_seconds())
                if token.expires_at
                else None
            ),
            "expires_at": token.expires_at,
            "token_type": "Bearer",
            "scope": " ".join(token.get_scopes()),
            "user": {
                "id": str(token.user.id),
                # we might need these to become scope based
                "name": token.user.name,
                "email": token.user.email,
            },
        }
        if id_token:
            token_information["id_token"] = id_token
        if token.scoping_organization_id:
            token_information["organization_id"] = str(token.scoping_organization_id)
        return HttpResponse(
            json.dumps(token_information),
            content_type="application/json",
        )

    def handle_public_client_refresh(
        self, request: Request, application: ApiApplication
    ) -> HttpResponse:
        """
        Handle refresh token for public clients with rotation (RFC 9700 §4.14.2).

        Security model:
        - Each refresh issues a new refresh token and invalidates the old one
        - If an old (rotated) refresh token is reused, the entire token family is revoked
        - This detects token theft: attacker and legitimate client will collide

        The token family groups all tokens descended from the same original authorization.
        When replay is detected, revoking the family ensures both the attacker's and the
        legitimate client's tokens are invalidated, forcing re-authorization.
        """
        refresh_token_code = request.POST.get("refresh_token")

        if not refresh_token_code:
            return self.error(
                request=request,
                name="invalid_request",
                reason="missing refresh_token",
            )

        # Scope changes not supported
        if request.POST.get("scope"):
            return self.error(
                request=request,
                name="invalid_request",
                reason="scope changes not supported",
            )

        # Hash the incoming refresh token for secure lookup
        hashed_refresh = hashlib.sha256(refresh_token_code.encode()).hexdigest()

        # Try to find the token by its hashed refresh token
        try:
            old_token = ApiToken.objects.get(
                application=application,
                hashed_refresh_token=hashed_refresh,
            )
        except ApiToken.DoesNotExist:
            # Token not found - check if this is a replay of a rotated-out token
            # (i.e., someone is using a refresh token that was already exchanged)
            replayed_token = ApiToken.objects.filter(
                application=application,
                previous_refresh_token_hash=hashed_refresh,
            ).first()

            if replayed_token and replayed_token.token_family_id:
                # REPLAY ATTACK DETECTED - revoke entire token family
                self._revoke_token_family(
                    replayed_token.token_family_id,
                    reason="replay_of_rotated_token",
                )
                return self.error(
                    request=request,
                    name="invalid_grant",
                    reason="token reuse detected",
                )

            return self.error(
                request=request,
                name="invalid_grant",
                reason="invalid refresh_token",
            )

        # Check if this token's refresh capability is still active
        # (False means it was already rotated - replay attack)
        if old_token.is_refresh_token_active is False:
            if old_token.token_family_id:
                self._revoke_token_family(
                    old_token.token_family_id,
                    reason="inactive_token_reuse",
                )
            return self.error(
                request=request,
                name="invalid_grant",
                reason="token reuse detected",
            )

        # Assign family ID if this is a legacy token (first rotation)
        # This enables lazy migration of existing tokens to the rotation system
        family_id = old_token.token_family_id or uuid.uuid4()

        # Perform atomic rotation: invalidate old, create new
        with transaction.atomic(router.db_for_write(ApiToken)):
            # Mark old token's refresh capability as used
            old_token.is_refresh_token_active = False
            old_token.token_family_id = family_id  # Ensure family is set
            old_token.save(update_fields=["is_refresh_token_active", "token_family_id"])

            # Create new token in the same family
            new_token = ApiToken.objects.create(
                application=application,
                user=old_token.user,
                scope_list=old_token.get_scopes(),
                scoping_organization_id=old_token.scoping_organization_id,
                token_family_id=family_id,
                previous_refresh_token_hash=old_token.hashed_refresh_token,
            )

        metrics.incr("oauth.public_client_refresh_rotated", sample_rate=1.0)
        logger.info(
            "oauth.refresh-token-rotated",
            extra={
                "family_id": str(family_id),
                "old_token_id": old_token.id,
                "new_token_id": new_token.id,
                "application_id": application.id,
                "user_id": old_token.user_id,
            },
        )

        return self.process_token_details(token=new_token)

    def _revoke_token_family(self, family_id: uuid.UUID, reason: str) -> int:
        """
        Revoke all tokens in a family due to a security event (e.g., replay attack).

        Per RFC 9700 §4.14.2, when refresh token reuse is detected, the authorization
        server cannot determine which party (attacker or legitimate client) has the
        valid token, so it revokes the entire family to stop the attack.

        Args:
            family_id: UUID of the token family to revoke
            reason: Why the family is being revoked (for logging/metrics)

        Returns:
            Number of tokens deleted
        """

        # Use unguarded_write because deleting tokens triggers SET_NULL on
        # SentryAppInstallation.api_token, which is a cross-model write
        with unguarded_write(using=router.db_for_write(ApiToken)):
            count, _ = ApiToken.objects.filter(token_family_id=family_id).delete()

        metrics.incr(
            "oauth.token_family_revoked",
            sample_rate=1.0,
            tags={"reason": reason},
        )
        logger.warning(
            "oauth.token-family-revoked",
            extra={
                "family_id": str(family_id),
                "tokens_revoked": count,
                "reason": reason,
            },
        )

        return count
