import logging

from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.generic.base import View

from sentry.models import ApiApplication, ApiApplicationStatus, ApiGrant, ApiToken
from sentry.utils import json

logger = logging.getLogger("sentry.api")


class OAuthTokenView(View):
    @csrf_exempt
    @never_cache
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    # Note: the reason parameter is for internal use only
    def error(self, request, name, reason=None, status=400):
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
    def post(self, request):
        grant_type = request.POST.get("grant_type")

        if grant_type == "authorization_code":
            client_id = request.POST.get("client_id")
            redirect_uri = request.POST.get("redirect_uri")
            code = request.POST.get("code")

            if not client_id:
                return self.error(request, "invalid_client", "missing client_id")

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

            token = ApiToken.from_grant(grant)
        elif grant_type == "refresh_token":
            refresh_token = request.POST.get("refresh_token")
            scope = request.POST.get("scope")
            client_id = request.POST.get("client_id")

            if not refresh_token:
                return self.error(request, "invalid_request")

            # TODO(dcramer): support scope
            if scope:
                return self.error(request, "invalid_request")

            if not client_id:
                return self.error(request, "invalid_client", "missing client_id")

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
        else:
            return self.error(request, "unsupported_grant_type")

        return HttpResponse(
            json.dumps(
                {
                    "access_token": token.token,
                    "refresh_token": token.refresh_token,
                    "expires_in": int((token.expires_at - timezone.now()).total_seconds())
                    if token.expires_at
                    else None,
                    "expires_at": token.expires_at,
                    "token_type": "bearer",
                    "scope": " ".join(token.get_scopes()),  # NOQA
                    "user": {
                        "id": str(token.user.id),
                        # we might need these to become scope based
                        "name": token.user.name,
                        "email": token.user.email,
                    },
                }
            ),
            content_type="application/json",
        )
