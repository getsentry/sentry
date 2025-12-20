from __future__ import annotations

import base64
import logging
from datetime import datetime
from typing import Literal, NotRequired, TypedDict

from django.db import router
from django.http import HttpRequest, HttpResponse
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.generic.base import View
from rest_framework.request import Request

from sentry import options, ratelimits as ratelimiter
from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus
from sentry.models.apigrant import ApiGrant, ExpiredGrantError, InvalidGrantError
from sentry.models.apitoken import ApiToken
from sentry.sentry_apps.token_exchange.util import GrantTypes
from sentry.silo.safety import unguarded_write
from sentry.utils import json, metrics
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
          obtain a new access token.

        Supported grant types
        - `authorization_code` (RFC 6749 §4.1): requires `code` and, if bound,
          a matching `redirect_uri` (§4.1.3). If `openid` scope was granted and
          signing is configured, an `id_token` (OIDC Core 1.0) is included.
        - `refresh_token` (RFC 6749 §6): requires `refresh_token`. Supplying `scope`
          is not supported here and returns `invalid_request`.

        Client authentication
        - Either Authorization header (Basic) or form fields `client_id`/`client_secret`
          (RFC 6749 §2.3.1). Only one method may be used per request.

        Request format
        - Requests are `application/x-www-form-urlencoded` as defined in RFC 6749 §3.2.

        Responses
        - Success (RFC 6749 §5.1): 200 JSON with `access_token`, `refresh_token`,
          `expires_in`/`expires_at`, `token_type` (Bearer), `scope`, `user`, and
          optionally `id_token` and `organization_id`.
        - Errors (RFC 6749 §5.2): 400 JSON for `invalid_request`, `invalid_grant`,
          `unsupported_grant_type`; 401 JSON for `invalid_client` (with
          `WWW-Authenticate: Basic realm="oauth"`).
        """
        grant_type = request.POST.get("grant_type")

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
            },
        )

        if not client_id or not client_secret:
            return self.error(
                request=request,
                name="invalid_client",
                reason="missing client credentials",
                status=401,
            )

        if not grant_type:
            return self.error(request=request, name="invalid_request", reason="missing grant_type")
        if grant_type not in [GrantTypes.AUTHORIZATION, GrantTypes.REFRESH]:
            return self.error(request=request, name="unsupported_grant_type")

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
        else:
            token_data = self.get_refresh_token(request=request, application=application)
        if "error" in token_data:
            status = 429 if token_data["error"] == "rate_limited" else 400
            return self.error(
                request=request,
                name=token_data["error"],
                reason=token_data["reason"] if "reason" in token_data else None,
                status=status,
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
            return {"error": "invalid_grant", "reason": str(e) if str(e) else "invalid grant"}
        except ExpiredGrantError as e:
            return {"error": "invalid_grant", "reason": str(e) if str(e) else "grant expired"}

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

        # Rate limit by (application_id, user_id) pair to prevent token refresh abuse
        if ratelimiter.backend.is_limited(
            f"oauth:refresh:{application.id}:{refresh_token.user_id}",
            limit=10,
            window=60,
        ):
            return {"error": "rate_limited", "reason": "too many token refresh attempts"}

        refresh_token.refresh()

        return {"token": refresh_token}

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
