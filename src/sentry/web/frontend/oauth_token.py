from __future__ import annotations

import logging
from datetime import datetime
from typing import Literal, NotRequired, TypedDict

from django.http import HttpRequest, HttpResponse
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.generic.base import View
from rest_framework.request import Request

from sentry import options
from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.sentry_apps.token_exchange.util import GrantTypes
from sentry.utils import json, metrics
from sentry.utils.locking import UnableToAcquireLock
from sentry.web.frontend.base import control_silo_view
from sentry.web.frontend.openidtoken import OpenIDToken

logger = logging.getLogger("sentry.api.oauth_token")


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
    @csrf_exempt
    @method_decorator(never_cache)
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    # Note: the reason parameter is for internal use only
    def error(self, request: HttpRequest, name, reason=None, status=400):
        client_id = request.POST.get("client_id")

        logging.error(
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
        # RFC 6749 §5.2, §5.1 cache prevention
        resp["Cache-Control"] = "no-store"
        resp["Pragma"] = "no-cache"
        # RFC 6749 §5.2 invalid_client requires WWW-Authenticate header
        if name == "invalid_client":
            resp["WWW-Authenticate"] = 'Basic realm="oauth"'
        return resp

    @method_decorator(never_cache)
    def post(self, request: Request) -> HttpResponse:
        grant_type = request.POST.get("grant_type")

        # Extract client credentials per OAuth 2.1 (prefer Basic header over body)
        auth_header = request.META.get("HTTP_AUTHORIZATION", "") or request.headers.get(
            "Authorization", ""
        )
        basic_client_id = basic_client_secret = None
        if isinstance(auth_header, str) and auth_header:
            import base64

            scheme, _, param = auth_header.partition(" ")
            if scheme and scheme.lower() == "basic" and param:
                b64 = param.strip()
                try:
                    decoded = base64.b64decode(b64).decode("utf-8")
                    # format: client_id:client_secret (client_secret may be empty)
                    if ":" not in decoded:
                        raise ValueError("missing colon in basic credentials")
                    basic_client_id, basic_client_secret = decoded.split(":", 1)
                except Exception:
                    logger.warning("Invalid Basic auth header", extra={"client_id": None})
                    return self.error(
                        request=request,
                        name="invalid_client",
                        reason="invalid basic auth",
                        status=401,
                    )

        body_client_id = request.POST.get("client_id")
        body_client_secret = request.POST.get("client_secret")

        # If both Basic header and body credentials are present -> invalid_request
        if basic_client_id is not None and (body_client_id or body_client_secret):
            logger.info(
                "oauth.basic-and-body-credentials",
                extra={"client_id": basic_client_id or body_client_id, "reason": "conflict"},
            )
            return self.error(request=request, name="invalid_request", reason="credential conflict")

        # Choose credentials: header preferred, then body
        client_id = basic_client_id if basic_client_id is not None else body_client_id
        client_secret = (
            basic_client_secret if basic_client_secret is not None else body_client_secret
        )

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
            application = ApiApplication.objects.get(
                client_id=client_id, client_secret=client_secret, status=ApiApplicationStatus.active
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

        if grant_type == GrantTypes.AUTHORIZATION:
            token_data = self.get_access_tokens(request=request, application=application)
        else:
            token_data = self.get_refresh_token(request=request, application=application)
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

    def get_access_tokens(self, request: Request, application: ApiApplication) -> dict:
        code = request.POST.get("code")
        try:
            grant = ApiGrant.objects.get(
                application=application, application__status=ApiApplicationStatus.active, code=code
            )
        except ApiGrant.DoesNotExist:
            return {"error": "invalid_grant", "reason": "invalid grant"}

        if grant.is_expired():
            return {"error": "invalid_grant", "reason": "grant expired"}

        # Enforce redirect_uri binding (RFC 6749 §4.1.3)
        redirect_uri = request.POST.get("redirect_uri")
        if grant.redirect_uri and grant.redirect_uri != redirect_uri:
            return {"error": "invalid_grant", "reason": "invalid redirect URI"}

        try:
            token_data = {"token": ApiToken.from_grant(grant=grant)}
        except UnableToAcquireLock:
            # TODO(mdtro): we should return a 409 status code here
            return {"error": "invalid_grant", "reason": "invalid grant"}

        if grant.has_scope("openid") and options.get("codecov.signing_secret"):
            open_id_token = OpenIDToken(
                application.client_id,
                grant.user_id,
                options.get("codecov.signing_secret"),
                nonce=request.POST.get("nonce"),
            )
            token_data["id_token"] = open_id_token.get_signed_id_token(grant=grant)

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
        resp = HttpResponse(
            json.dumps(token_information),
            content_type="application/json",
        )
        # RFC 6749 §5.1 cache prevention
        resp["Cache-Control"] = "no-store"
        resp["Pragma"] = "no-cache"
        return resp
