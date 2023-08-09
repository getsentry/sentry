import logging
from typing import Optional

from django.db.models import Q
from django.http import HttpRequest, HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.generic.base import View

from sentry.models import ApiApplication, ApiApplicationStatus, ApiToken
from sentry.utils import json, metrics

logger = logging.getLogger("sentry.api.oauth_revoke")


class OAuthRevokeView(View):
    """
    OAuth 2.0 token revoke endpoint per RFC 7009
    https://www.rfc-editor.org/rfc/rfc7009

    Clients can provide either the access_token or refresh_token in the request.

    When revoking the token, the associated access_token or refresh_token is also
    revoked.
    """

    @csrf_exempt
    @method_decorator(never_cache)
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    def error(self, request: HttpRequest, name, error_description=None, status=400):
        client_id = request.POST.get("client_id")

        logging.error(
            "oauth.revoke-error",
            extra={
                "error_name": name,
                "status": status,
                "client_id": client_id,
                "reason": error_description,
            },
        )
        return HttpResponse(
            json.dumps({"error": name, "error_description": error_description}),
            content_type="application/json",
            status=status,
        )

    @method_decorator(never_cache)
    def post(self, request: HttpRequest) -> HttpResponse:
        """
        Handles POST request to revoke an access_token or refresh_token.
        Will respond with errors aligned with RFC 6749 Section 5.2.
        https://datatracker.ietf.org/doc/html/rfc6749#section-5.2
        """
        token = request.POST.get("token")
        token_type_hint = request.POST.get("token_type_hint")  # optional
        client_id = request.POST.get("client_id")
        client_secret = request.POST.get("client_secret")

        metrics.incr(
            "oauth_revoke.post.start",
            sample_rate=1.0,
            tags={
                "client_id_exists": bool(client_id),
                "client_secret_exists": bool(client_secret),
            },
        )

        if not client_id:
            return self.error(
                request=request,
                name="invalid_client",
                error_description="client_id parameter not found",
            )

        if not client_secret:
            return self.error(
                request=request,
                name="invalid_client",
                error_description="client_secret parameter not found",
            )

        if not token:
            return self.error(
                request=request,
                name="invalid_request",
                error_description="token parameter not found",
            )

        if token_type_hint is not None and token_type_hint not in ["access_token", "refresh_token"]:
            return self.error(
                request=request,
                name="unsupported_token_type",
                error_description="an unsupported token_type_hint was provided, must be either 'access_token' or 'refresh_token'",
            )

        try:
            application = ApiApplication.objects.get(
                client_id=client_id, client_secret=client_secret, status=ApiApplicationStatus.active
            )
        except ApiApplication.DoesNotExist:
            metrics.incr(
                "oauth_revoke.post.invalid",
                sample_rate=1.0,
            )
            logger.warning("Invalid client_id / secret pair", extra={"client_id": client_id})
            return self.error(
                request=request,
                name="invalid_credentials",
                error_description="invalid client_id or client_secret",
                status=401,
            )

        token_to_delete = self.get_token_to_delete(
            token=token, token_type_hint=token_type_hint, application=application
        )

        # only delete the token if one was found
        if token_to_delete:
            token_to_delete.delete()

        # even in the case of invalid tokens we are supposed to respond with an HTTP 200 per the RFC
        # See: https://www.rfc-editor.org/rfc/rfc7009#section-2.2
        return HttpResponse(status=200)

    def get_token_to_delete(
        self, token: str, token_type_hint: Optional[str], application: ApiApplication
    ) -> Optional[ApiToken]:
        try:
            if token_type_hint == "access_token":
                token_to_delete = ApiToken.objects.get(token=token)
            elif token_type_hint == "refresh_token":
                token_to_delete = ApiToken.objects.get(refresh_token=token)
            else:
                # the client request did not provide a token hint so we must check both token (aka. access_token)
                # and refresh_token for a match
                query = Q(token=token)
                query.add(Q(refresh_token=token), Q.OR)
                query.add(
                    Q(application=application), Q.AND
                )  # restrict to the oauth client application
                token_to_delete = ApiToken.objects.get(query)

            return token_to_delete
        except ApiToken.DoesNotExist:
            # RFC 7009 requires us to gracefully handle request for revocation of tokens that do not exist
            return None
