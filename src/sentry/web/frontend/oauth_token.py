import logging

from django.http import HttpRequest, HttpResponse
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.generic.base import View

from sentry.mediators import GrantTypes
from sentry.models import ApiApplication, ApiApplicationStatus, ApiGrant, ApiToken, OpenIDToken
from sentry.utils import json

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
        grant_type = request.POST.get("grant_type")
        client_id = request.POST.get("client_id")
        if not client_id:
            return self.error(request, "invalid_client", "missing client_id")
        if grant_type == GrantTypes.AUTHORIZATION:
            return self._get_access_tokens(request, client_id)
        elif grant_type == GrantTypes.REFRESH:
            return self._get_refresh_token(request, client_id)
        else:
            return self.error(request, "unsupported_grant_type")

    def _get_access_tokens(self, request, client_id):
        redirect_uri = request.POST.get("redirect_uri")
        code = request.POST.get("code")

        try:
            application = ApiApplication.objects.get(
                client_id=client_id, status=ApiApplicationStatus.active
            )
        except ApiApplication.DoesNotExist:
            return self.error(request, "invalid_client", "invalid client_id")

        try:
            grant = ApiGrant.objects.get(application=application, code=code)
        except ApiGrant.DoesNotExist:
            return self.error(request, "invalid_grant", "invalid grant")

        if grant.is_expired():
            return self.error(request, "invalid_grant", "grant expired")

        if not redirect_uri:
            redirect_uri = application.get_default_redirect_uri()
        elif grant.redirect_uri != redirect_uri:
            return self.error(request, "invalid_grant", "invalid redirect_uri")

        access_token = ApiToken.from_grant(grant)
        id_token = self._get_open_id_token(grant, request)
        return self._process_token_details(access_token, id_token)

    def _get_open_id_token(self, grant, request):
        if grant.has_scope("openid"):
            open_id_token = OpenIDToken.objects.create(
                user=grant.user,
                aud=request.POST.get("client_id"),
                nonce=request.POST.get("nonce"),
            )
            return open_id_token.get_encrypted_id_token()
        return None

    def _get_refresh_token(self, request, client_id):
        refresh_token = request.POST.get("refresh_token")
        scope = request.POST.get("scope")

        if not refresh_token:
            return self.error(request, "invalid_request")

        # TODO(dcramer): support scope
        if scope:
            return self.error(request, "invalid_request")

        try:
            application = ApiApplication.objects.get(
                client_id=client_id, status=ApiApplicationStatus.active
            )
        except ApiApplication.DoesNotExist:
            return self.error(request, "invalid_client", "invalid client_id")

        try:
            token = ApiToken.objects.get(application=application, refresh_token=refresh_token)
        except ApiToken.DoesNotExist:
            return self.error(request, "invalid_grant", "invalid token")

        token.refresh()

        return self._process_token_details(token)

    def _process_token_details(self, token, id_token=None):
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
