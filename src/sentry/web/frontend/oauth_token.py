import datetime
import logging
import secrets
from typing import Union

from django.http import HttpRequest, HttpResponse
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.generic.base import View
from rest_framework.request import Request

from sentry.mediators import GrantTypes
from sentry.models import ApiApplication, ApiApplicationStatus, ApiGrant, ApiToken
from sentry.utils import json
from sentry.web.frontend.openidtoken import OpenIDToken

logger = logging.getLogger("sentry.api")


class OAuthTokenView(View):
    @csrf_exempt
    @never_cache
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

    @never_cache
    def post(self, request: HttpRequest) -> HttpResponse:
        client_details = self._get_client_details_if_valid_request(request=request)

        if not isinstance(client_details, dict):
            return client_details  # client_details contains an error response.

        if client_details["grant_type"] == GrantTypes.AUTHORIZATION:
            return self._get_access_tokens(
                request=request, application=client_details["application"]
            )
        return self._get_refresh_token(request, application=client_details["application"])

    def _get_client_details_if_valid_request(self, request: Request) -> Union[dict, HttpResponse]:
        """Returns the client's ID and associated ApiApplication if they provided the correct client secret."""
        grant_type = request.POST.get("grant_type")
        client_id = request.POST.get("client_id")
        if not client_id:
            return self.error(request, "invalid_client", "missing client_id")
        if grant_type not in [GrantTypes.AUTHORIZATION, GrantTypes.REFRESH]:
            return self.error(request, "unsupported_grant_type")
        try:
            application = ApiApplication.objects.get(
                client_id=client_id, status=ApiApplicationStatus.active
            )
        except ApiApplication.DoesNotExist:
            return self.error(request, "invalid_client", "invalid client_id")

        # date that we started requiring client secrets
        cutoff_date = datetime.datetime(2023, 7, 16).astimezone()

        if application.date_added > cutoff_date:
            client_secret = request.POST.get("client_secret")
            if not client_secret:
                return self.error(request, "missing client_secret")
            elif client_secret != application.client_secret:
                return self.error(request, "invalid client_secret")

        return {"client_id": client_id, "grant_type": grant_type, "application": application}

    def _get_access_tokens(self, request: Request, application: ApiApplication) -> HttpResponse:
        code = request.POST.get("code")
        try:
            grant = ApiGrant.objects.get(application=application, code=code)
        except ApiGrant.DoesNotExist:
            return self.error(request, "invalid_grant", "invalid grant")

        if grant.is_expired():
            return self.error(request, "invalid_grant", "grant expired")

        redirect_uri = request.POST.get("redirect_uri")
        if not redirect_uri:
            redirect_uri = application.get_default_redirect_uri()
        elif grant.redirect_uri != redirect_uri:
            return self.error(request, "invalid_grant", "invalid redirect_uri")

        access_token = ApiToken.from_grant(grant=grant)
        id_token = self._get_open_id_token(request=request, grant=grant)
        return self._process_token_details(token=access_token, id_token=id_token)

    def _get_open_id_token(self, request: Request, grant: ApiGrant) -> Union[OpenIDToken, None]:
        if grant.has_scope("openid"):
            open_id_token = OpenIDToken(
                request.POST.get("client_id"),
                grant.user_id,
                # Encrypt with a random secret until we implement secure shared secrets in prod
                secrets.token_urlsafe(),
                nonce=request.POST.get("nonce"),
            )
            return open_id_token.get_encrypted_id_token(grant=grant)
        return None

    def _get_refresh_token(self, request: Request, application: ApiApplication) -> HttpResponse:
        refresh_token_code = request.POST.get("refresh_token")
        scope = request.POST.get("scope")

        if not refresh_token_code:
            return self.error(request, "invalid_request")

        # TODO(dcramer): support scope
        if scope:
            return self.error(request, "invalid_request")

        try:
            refresh_token = ApiToken.objects.get(
                application=application, refresh_token=refresh_token_code
            )
        except ApiToken.DoesNotExist:
            return self.error(request, "invalid_grant", "invalid refresh token")

        refresh_token.refresh()

        return self._process_token_details(token=refresh_token)

    def _process_token_details(
        self, token: ApiToken, id_token: Union[OpenIDToken, None] = None
    ) -> HttpResponse:
        token_information = {
            "access_token": token.token,
            "refresh_token": token.refresh_token,
            "expires_in": int((token.expires_at - timezone.now()).total_seconds())
            if token.expires_at
            else None,
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
        return HttpResponse(
            json.dumps(token_information),
            content_type="application/json",
        )
