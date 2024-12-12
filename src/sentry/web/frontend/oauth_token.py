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
    token_type: Literal["bearer"]
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
        redirect_uri = request.POST.get("redirect_uri")

        logging.error(
            "oauth.token-error",
            extra={
                "error_name": name,
                "status": status,
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "reason": reason,
            },
        )
        return HttpResponse(
            json.dumps({"error": name}), content_type="application/json", status=status
        )

    @method_decorator(never_cache)
    def post(self, request: Request) -> HttpResponse:
        grant_type = request.POST.get("grant_type")
        client_id = request.POST.get("client_id")
        client_secret = request.POST.get("client_secret")

        metrics.incr(
            "oauth_token.post.start",
            sample_rate=1.0,
            tags={
                "client_id_exists": bool(client_id),
                "client_secret_exists": bool(client_secret),
            },
        )

        if not client_id:
            return self.error(request=request, name="missing_client_id", reason="missing client_id")
        if not client_secret:
            return self.error(
                request=request, name="missing_client_secret", reason="missing client_secret"
            )

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
                name="invalid_credentials",
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

        redirect_uri = request.POST.get("redirect_uri")
        if not redirect_uri:
            redirect_uri = application.get_default_redirect_uri()
        elif grant.redirect_uri != redirect_uri:
            return {"error": "invalid_grant", "reason": "invalid redirect URI"}

        try:
            token_data = {"token": ApiToken.from_grant(grant=grant)}
        except UnableToAcquireLock:
            # TODO(mdtro): we should return a 409 status code here
            return {"error": "invalid_grant", "reason": "invalid grant"}

        if grant.has_scope("openid") and options.get("codecov.signing_secret"):
            open_id_token = OpenIDToken(
                request.POST.get("client_id"),
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
            "token_type": "bearer",
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
