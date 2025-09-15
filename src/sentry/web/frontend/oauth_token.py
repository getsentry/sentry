from __future__ import annotations

import base64
import hashlib
import logging
import re
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

_PKCE_VERIFIER_RE = re.compile(r"^[A-Za-z0-9\-\._~]{43,128}$")


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

        # Enforce redirect_uri binding with application-version-aware behavior
        app_version = getattr(grant.application, "version", 0) or 0
        redirect_uri = request.POST.get("redirect_uri")
        redirect_check = self._check_redirect_binding(
            application=application,
            grant=grant,
            request_redirect_uri=redirect_uri,
            app_version=app_version,
        )
        if redirect_check is not None:
            return redirect_check

        # PKCE verification with application-version-aware behavior
        pkce_error = self._verify_pkce(
            grant=grant,
            code_verifier=request.POST.get("code_verifier"),
            app_version=app_version,
        )
        if pkce_error is not None:
            return pkce_error

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

    @staticmethod
    def _compute_s256(code_verifier: str) -> str:
        digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
        return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")

    def _check_redirect_binding(
        self,
        *,
        application: ApiApplication,
        grant: ApiGrant,
        request_redirect_uri: str | None,
        app_version: int,
    ) -> dict | None:
        """Validate redirect_uri binding and log legacy fallback.

        Returns an error dict on failure, otherwise None. The resolved redirect_uri
        is not used downstream, so there is no return of the value here.
        """
        if app_version >= 1:
            if grant.redirect_uri and (
                not request_redirect_uri or grant.redirect_uri != request_redirect_uri
            ):
                return {"error": "invalid_grant", "reason": "invalid redirect URI"}
            return None

        # v0 legacy behavior
        if not request_redirect_uri:
            logger.warning(
                "oauth.token-legacy-redirect-fallback",
                extra={
                    "application_id": grant.application_id,
                    "client_id": application.client_id,
                    "grant_id": grant.id,
                },
            )
            # Allow fallback; nothing else to check
            return None

        if grant.redirect_uri != request_redirect_uri:
            return {"error": "invalid_grant", "reason": "invalid redirect URI"}
        return None

    def _verify_pkce(
        self, *, grant: ApiGrant, code_verifier: str | None, app_version: int
    ) -> dict | None:
        if not grant.code_challenge:
            return None

        # For v0: missing verifier is allowed (log), provided one must validate
        if app_version < 1 and not code_verifier:
            logger.warning(
                "oauth.token-legacy-pkce-missing-verifier",
                extra={
                    "application_id": grant.application_id,
                    "client_id": grant.application.client_id,
                    "grant_id": grant.id,
                },
            )
            return None

        # For v1 or when provided in v0, validate per RFC 7636
        if not code_verifier:
            return {"error": "invalid_grant", "reason": "missing code_verifier"}
        if len(code_verifier) < 43 or len(code_verifier) > 128:
            return {"error": "invalid_grant", "reason": "invalid code_verifier length"}
        if not _PKCE_VERIFIER_RE.match(code_verifier):
            return {"error": "invalid_grant", "reason": "invalid code_verifier charset"}

        method = (grant.code_challenge_method or "S256").upper()
        if method == "S256":
            computed = self._compute_s256(code_verifier)
            if computed != grant.code_challenge:
                return {"error": "invalid_grant", "reason": "pkce verification failed"}
            return None

        if method == "PLAIN":
            # v1 forbids plain; v0 allows plain
            if app_version >= 1:
                return {"error": "invalid_grant", "reason": "pkce verification failed"}
            if code_verifier != grant.code_challenge:
                return {"error": "invalid_grant", "reason": "pkce verification failed"}
            return None

        return {"error": "invalid_grant", "reason": "unsupported pkce method"}

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
