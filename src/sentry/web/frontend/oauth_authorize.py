from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlparse

from django.contrib.auth.views import redirect_to_login
from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseBase
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.utils.safestring import mark_safe
from django.views.decorators.cache import never_cache

from sentry import analytics, options
from sentry.analytics.events.oauth_consent import OAuthConsentEvent
from sentry.api.helpers.oauth_authorize.approval import approve_authorization
from sentry.api.helpers.oauth_authorize.request import build_authorization_request
from sentry.api.helpers.oauth_authorize.response import (
    InvalidAuthorizationRequest,
    OAuthRedirectError,
    build_redirect_url,
)
from sentry.api.helpers.oauth_authorize.transactions import (
    consume_authorization_transaction,
    prune_authorization_transactions,
    save_authorization_transaction,
)
from sentry.api.helpers.oauth_consent import (
    get_organization_options,
    get_permission_descriptions,
    has_existing_consent,
)
from sentry.api.serializers.rest_framework.oauth_authorize import OAuthAuthorizeQuerySerializer
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import auth
from sentry.web.client_config import get_client_config
from sentry.web.frontend.base import BaseView, control_silo_view
from sentry.web.frontend.react_page import ReactMixin

logger = logging.getLogger("sentry.oauth")


@control_silo_view
@method_decorator(never_cache, name="dispatch")
class OAuthAuthorizeView(BaseView, ReactMixin):
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={"GET": {RateLimitCategory.IP: RateLimit(limit=20, window=1)}}
    )

    def is_auth_required(self, request: HttpRequest, *args: Any, **kwargs: Any) -> bool:
        # GET validates OAuth parameters before prompting for authentication.
        if request.method == "GET":
            return False

        return super().is_auth_required(request, *args, **kwargs)

    def handle_auth_required(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
        auth.initiate_login(request, next_url=request.get_full_path())

        response = redirect_to_login(request.get_full_path(), reverse("sentry-login"))
        response["X-Robots-Tag"] = "noindex, nofollow"
        return response

    def get_context_data(self, request: HttpRequest, **kwargs) -> dict:
        return {
            **super().get_context_data(request, **kwargs),
            "react_config": get_client_config(request, self.active_organization),
        }

    def redirect_response(self, response_type, redirect_uri, params):
        return self.redirect_to_callback(build_redirect_url(response_type, redirect_uri, params))

    def redirect_to_callback(self, final_uri: str) -> HttpResponseBase:
        # Django's HttpResponseRedirect blocks custom URL schemes for security.
        # For OAuth redirects to Sentry Apple apps, we need to support the
        # sentry-apple:// scheme, so we use HttpResponse with a Location
        # header directly.
        parsed_uri = urlparse(final_uri)
        if parsed_uri.scheme == "sentry-apple" or parsed_uri.scheme == "sentry-replay-debugger":
            response = HttpResponse(status=302)
            response["Location"] = final_uri
            return response

        return self.redirect(final_uri)

    def error(
        self,
        request,
        response_type,
        redirect_uri,
        name,
        state=None,
        client_id=None,
        err_response=None,
    ):
        logger.error(
            "oauth.authorize-error",
            extra={
                "error_name": name,
                "response_type": response_type,
                "client_id": client_id,
                "redirect_uri": redirect_uri,
            },
        )
        if err_response:
            return self.respond(
                "sentry/oauth-error.html",
                {"error": mark_safe(f"Missing or invalid <em>{err_response}</em> parameter.")},
                status=400,
            )

        return self.redirect_response(response_type, redirect_uri, {"error": name, "state": state})

    def get(self, request: HttpRequest, **kwargs) -> HttpResponseBase:
        if options.get("auth.oauth-react-enabled"):
            return self.handle_react(request)

        try:
            serializer = OAuthAuthorizeQuerySerializer(data=request.GET)
            if not serializer.is_valid():
                raise InvalidAuthorizationRequest(
                    "Missing or invalid client_id parameter.", parameter="client_id"
                )

            authorization = build_authorization_request(serializer.validated_data)
        except InvalidAuthorizationRequest as exc:
            return self.error(
                request=request,
                client_id=request.GET.get("client_id"),
                response_type=request.GET.get("response_type"),
                redirect_uri=request.GET.get("redirect_uri"),
                name="invalid_request",
                err_response=exc.parameter,
            )
        except OAuthRedirectError as exc:
            return self.redirect_to_callback(exc.redirect_url)

        if super().is_auth_required(request, **kwargs):
            return self.handle_auth_required(request, **kwargs)

        assert request.user.is_authenticated
        application = authorization.application
        prune_authorization_transactions(request.session)
        if not request.GET.get("force_prompt") and has_existing_consent(
            application, request.user.id, authorization.scopes
        ):
            return self.redirect_to_callback(approve_authorization(authorization, request.user.id))

        organization_options = get_organization_options(application, request.user.id)
        if application.requires_org_level_access and not organization_options:
            return self.respond(
                "sentry/oauth-error.html",
                {
                    "error": "This authorization flow is only available for users who are members of an organization."
                },
                status=400,
            )

        transaction_id = save_authorization_transaction(
            request.session, authorization, request.user.id
        )
        analytics.record(
            OAuthConsentEvent(
                user_id=request.user.id,
                application_id=application.id,
                response_type=authorization.response_type,
                outcome="viewed",
            )
        )
        return self.respond(
            "sentry/oauth-authorize.html",
            {
                "user": request.user,
                "application": application,
                "scopes": authorization.scopes,
                "permissions": get_permission_descriptions(authorization.scopes),
                "organization_options": organization_options,
                "tx_id": transaction_id,
            },
        )

    def post(self, request: HttpRequest, **kwargs) -> HttpResponseBase:
        assert request.user.is_authenticated

        try:
            authorization = consume_authorization_transaction(
                request.session, request.POST.get("tx_id", ""), request.user.id
            )
        except InvalidAuthorizationRequest as exc:
            error = (
                mark_safe(f"Missing or invalid <em>{exc.parameter}</em> parameter.")
                if exc.parameter
                else exc.public_message
            )
            return self.respond("sentry/oauth-error.html", {"error": error})

        op = request.POST.get("op")
        if op not in ("approve", "deny"):
            raise NotImplementedError

        analytics.record(
            OAuthConsentEvent(
                user_id=request.user.id,
                application_id=authorization.application.id,
                response_type=authorization.response_type,
                outcome="approved" if op == "approve" else "denied",
            )
        )
        if op == "deny":
            return self.error(
                request=request,
                client_id=authorization.application.client_id,
                response_type=authorization.response_type,
                redirect_uri=authorization.redirect_uri,
                name="access_denied",
                state=authorization.state,
            )

        try:
            redirect_url = approve_authorization(
                authorization, request.user.id, request.POST.get("selected_organization_id")
            )
        except OAuthRedirectError as exc:
            return self.redirect_to_callback(exc.redirect_url)

        return self.redirect_to_callback(redirect_url)
