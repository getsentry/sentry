from __future__ import annotations

import base64
import logging
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
from sentry.models.trustedidentityprovider import (
    IdPDisabledError,
    JWKSFetchError,
    JWTValidationError,
    KeyNotFoundError,
    TrustedIdentityProvider,
)
from sentry.ratelimits import backend as ratelimiter
from sentry.sentry_apps.token_exchange.util import GrantTypes
from sentry.silo.safety import unguarded_write
from sentry.users.models.user import User
from sentry.utils import json
from sentry.utils import jwt as sentry_jwt
from sentry.utils import metrics
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
            GrantTypes.JWT_BEARER,
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

        # Device flow supports public clients per RFC 8628 §5.6.
        # Public clients only provide client_id to identify themselves.
        # If client_secret is provided, we still validate it for confidential clients.
        if grant_type == GrantTypes.DEVICE_CODE:
            if not client_id:
                return self.error(
                    request=request,
                    name="invalid_client",
                    reason="missing client_id",
                    status=401,
                )

            # Build query - validate secret only if provided (confidential client)
            query = {"client_id": client_id}
            if client_secret:
                query["client_secret"] = client_secret

            try:
                application = ApiApplication.objects.get(**query)
            except ApiApplication.DoesNotExist:
                metrics.incr("oauth_token.post.invalid", sample_rate=1.0)
                if client_secret:
                    logger.warning(
                        "Invalid client_id / secret pair",
                        extra={"client_id": client_id},
                    )
                    reason = "invalid client_id or client_secret"
                else:
                    logger.warning("Invalid client_id", extra={"client_id": client_id})
                    reason = "invalid client_id"
                return self.error(
                    request=request,
                    name="invalid_client",
                    reason=reason,
                    status=401,
                )
        else:
            # Other grant types require confidential client authentication
            if not client_id or not client_secret:
                return self.error(
                    request=request,
                    name="invalid_client",
                    reason="missing client credentials",
                    status=401,
                )

            try:
                # Note: We don't filter by status here to distinguish between invalid
                # credentials (unknown client) and inactive applications. This allows
                # proper grant cleanup per RFC 6749 §10.5 and clearer metrics.
                application = ApiApplication.objects.get(
                    client_id=client_id,
                    client_secret=client_secret,
                )
            except ApiApplication.DoesNotExist:
                metrics.incr(
                    "oauth_token.post.invalid",
                    sample_rate=1.0,
                )
                logger.warning("Invalid client_id / secret pair", extra={"client_id": client_id})
                return self.error(
                    request=request,
                    name="invalid_client",
                    reason="invalid client_id or client_secret",
                    status=401,
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
        elif grant_type == GrantTypes.JWT_BEARER:
            return self.handle_jwt_bearer_grant(request=request, application=application)
        else:
            token_data = self.get_refresh_token(request=request, application=application)
        if "error" in token_data:
            return self.error(
                request=request,
                name=token_data["error"],
                reason=token_data.get("reason"),
            )
        return self.process_token_details(
            token=token_data["token"],
            id_token=token_data.get("id_token"),
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
                    # Create the access token
                    token = ApiToken.objects.create(
                        application=application,
                        user_id=device_code.user.id,
                        scope_list=device_code.scope_list,
                        scoping_organization_id=device_code.organization_id,
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

    def handle_jwt_bearer_grant(
        self, request: Request, application: ApiApplication
    ) -> HttpResponse:
        """
        Handle JWT Bearer grant type (RFC 7523) for ID-JAG tokens.

        This implements the Identity Assertion JWT Authorization Grant (ID-JAG)
        flow where an external IdP issues a JWT assertion that can be exchanged
        for a Sentry access token.

        Request format:
            POST /oauth/token
            Content-Type: application/x-www-form-urlencoded
            Authorization: Basic {base64(client_id:client_secret)}

            grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
            &assertion={id-jag-jwt}
            &scope=org:read project:read (optional)

        The JWT assertion must:
        - Be signed by a TrustedIdentityProvider's key (validated via JWKS)
        - Contain 'iss' claim matching a configured TrustedIdentityProvider
        - Contain 'sub' claim identifying the user
        - Contain 'email' claim for user lookup (current implementation)
        - Contain 'aud' claim matching Sentry's issuer identifier

        Returns:
        - On success: Access token response
        - invalid_request: Missing or malformed assertion
        - invalid_grant: JWT validation failed, issuer not trusted, or user not found
        """
        assertion = request.POST.get("assertion")
        requested_scope = request.POST.get("scope")

        if not assertion:
            return self.error(
                request=request,
                name="invalid_request",
                reason="missing assertion parameter",
            )

        # Peek at the JWT to get the issuer without full validation
        try:
            unverified_claims = sentry_jwt.peek_claims(assertion)
        except sentry_jwt.DecodeError as e:
            logger.warning(
                "JWT bearer grant: invalid assertion format",
                extra={"client_id": application.client_id, "error": str(e)},
            )
            return self.error(
                request=request,
                name="invalid_request",
                reason="invalid assertion format",
            )

        issuer = unverified_claims.get("iss")
        if not issuer:
            logger.warning(
                "JWT bearer grant: missing issuer claim",
                extra={"client_id": application.client_id},
            )
            return self.error(
                request=request,
                name="invalid_grant",
                reason="assertion missing issuer claim",
            )

        # Rate limit JWT bearer attempts per client+issuer to prevent brute force
        rate_limit_key = f"oauth:jwt_bearer:{application.client_id}:{issuer}"
        if ratelimiter.is_limited(rate_limit_key, limit=10, window=60):
            return self.error(
                request=request,
                name="slow_down",
                reason="too many requests",
            )

        # Look up TrustedIdentityProvider by issuer
        # We find all providers with this issuer and try each one
        trusted_idps = TrustedIdentityProvider.objects.filter(
            issuer=issuer,
            enabled=True,
        )

        if not trusted_idps.exists():
            logger.warning(
                "JWT bearer grant: untrusted issuer",
                extra={"client_id": application.client_id, "issuer": issuer},
            )
            return self.error(
                request=request,
                name="invalid_grant",
                reason="issuer not trusted",
            )

        # Try to validate the JWT with each matching IdP
        claims = None
        validated_idp = None
        last_error = None

        for idp in trusted_idps:
            # Check if client is allowed to use this IdP
            if not idp.is_client_allowed(application.client_id):
                continue

            try:
                # Validate JWT signature and get claims
                # audience validation is optional - pass None to skip
                claims = idp.validate_jwt_signature(
                    assertion,
                    audience=options.get("system.url-prefix") or None,
                )
                validated_idp = idp
                break
            except IdPDisabledError:
                # Skip disabled IdPs (shouldn't happen due to filter, but defensive)
                continue
            except (JWTValidationError, KeyNotFoundError, JWKSFetchError) as e:
                last_error = e
                logger.info(
                    "JWT bearer grant: validation failed for IdP",
                    extra={
                        "client_id": application.client_id,
                        "issuer": issuer,
                        "idp_id": idp.id,
                        "error": str(e),
                    },
                )
                continue

        if claims is None or validated_idp is None:
            error_msg = str(last_error) if last_error else "no matching IdP found"
            logger.warning(
                "JWT bearer grant: JWT validation failed",
                extra={
                    "client_id": application.client_id,
                    "issuer": issuer,
                    "error": error_msg,
                },
            )
            return self.error(
                request=request,
                name="invalid_grant",
                reason="assertion validation failed",
            )

        # Extract subject identifier using configured claim
        subject_claim = validated_idp.subject_claim
        subject = claims.get(subject_claim)
        if not subject:
            logger.warning(
                "JWT bearer grant: missing subject claim",
                extra={
                    "client_id": application.client_id,
                    "issuer": issuer,
                    "subject_claim": subject_claim,
                },
            )
            return self.error(
                request=request,
                name="invalid_grant",
                reason=f"assertion missing {subject_claim} claim",
            )

        # Map subject to Sentry user
        # Current implementation: lookup by email claim
        email = claims.get("email")
        if not email:
            logger.warning(
                "JWT bearer grant: missing email claim for user lookup",
                extra={
                    "client_id": application.client_id,
                    "issuer": issuer,
                    "subject": subject,
                },
            )
            return self.error(
                request=request,
                name="invalid_grant",
                reason="assertion missing email claim",
            )

        try:
            user = User.objects.get(email__iexact=email, is_active=True)
        except User.DoesNotExist:
            logger.warning(
                "JWT bearer grant: user not found",
                extra={
                    "client_id": application.client_id,
                    "issuer": issuer,
                    "subject": subject,
                    "email": email,
                },
            )
            return self.error(
                request=request,
                name="invalid_grant",
                reason="user not found",
            )
        except User.MultipleObjectsReturned:
            logger.warning(
                "JWT bearer grant: multiple users with same email",
                extra={
                    "client_id": application.client_id,
                    "issuer": issuer,
                    "email": email,
                },
            )
            return self.error(
                request=request,
                name="invalid_grant",
                reason="ambiguous user identity",
            )

        # Determine scopes for the token
        # Intersect: requested scopes ∩ IdP allowed scopes
        requested_scopes = set(requested_scope.split()) if requested_scope else set()
        idp_scopes = set(validated_idp.allowed_scopes) if validated_idp.allowed_scopes else None

        # If IdP has scope restrictions, apply them
        if idp_scopes is not None:
            final_scopes = requested_scopes & idp_scopes if requested_scopes else idp_scopes
        else:
            final_scopes = requested_scopes

        # Create the access token
        # Token is scoped to the IdP's organization
        with transaction.atomic(router.db_for_write(ApiToken)):
            token = ApiToken.objects.create(
                application=application,
                user=user,
                scope_list=list(final_scopes) if final_scopes else [],
                scoping_organization_id=validated_idp.organization_id,
            )

        metrics.incr("oauth_token.jwt_bearer.success", sample_rate=1.0)
        logger.info(
            "oauth.jwt-bearer-grant-success",
            extra={
                "client_id": application.client_id,
                "issuer": issuer,
                "idp_id": validated_idp.id,
                "user_id": user.id,
                "token_id": token.id,
                "organization_id": validated_idp.organization_id,
            },
        )

        return self.process_token_details(token=token)

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
