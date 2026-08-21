from typing import NotRequired, TypedDict, cast

from django.conf import settings
from django.contrib.auth import REDIRECT_FIELD_NAME
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.urls import reverse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import newsletter
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.serializers.models.auth import (
    AuthMfaMethodSerializerResponse,
    AuthMfaRequiredSerializerResponse,
    serialize_auth_mfa_required,
)
from sentry.constants import WARN_SESSION_EXPIRED
from sentry.http import get_server_hostname
from sentry.models.organization import Organization
from sentry.users.models.authenticator import Authenticator
from sentry.utils.auth import (
    get_org_redirect_url,
    get_pending_2fa_user,
    has_user_registration,
    initiate_login,
    is_valid_redirect,
)
from sentry.web.frontend.auth_login import additional_context
from sentry.web.frontend.base import OrganizationMixin, determine_active_organization


class AuthConfigResponse(TypedDict):
    serverHostname: str
    canRegister: bool
    hasNewsletter: bool
    pendingMfa: AuthMfaRequiredSerializerResponse | None
    mfaMethods: NotRequired[list[AuthMfaMethodSerializerResponse]]
    mfaRequired: NotRequired[bool]
    warning: NotRequired[str]


@control_silo_endpoint
class AuthConfigEndpoint(Endpoint, OrganizationMixin):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.FOUNDATIONS
    # Disable authentication and permission requirements.
    permission_classes = ()

    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponseBase:
        self.active_organization = determine_active_organization(request)
        return super().dispatch(request, *args, **kwargs)

    def get(self, request: Request, *args, **kwargs) -> Response:
        """
        Get context required to show a login page. Registration is handled elsewhere.
        """
        if request.user.is_authenticated:
            return self.respond_authenticated(request)

        user_pending_2fa = get_pending_2fa_user(request)
        if user_pending_2fa is not None:
            interfaces = Authenticator.objects.all_interfaces_for_user(user_pending_2fa)
            payload = self.prepare_login_context(request, *args, **kwargs)
            pending_mfa = serialize_auth_mfa_required(
                user_pending_2fa, [interface.interface_id for interface in interfaces]
            )
            payload["pendingMfa"] = pending_mfa
            # The deployed legacy frontend reads these flat keys during the rollout.
            payload["mfaRequired"] = pending_mfa["mfaRequired"]
            payload["mfaMethods"] = pending_mfa["mfaMethods"]
            # Preserve the pending MFA and redirect state that initiate_login clears below.
            return Response(payload)

        next_uri = self.get_next_uri(request)

        # we always reset the state on GET so you don't end up at an odd location
        initiate_login(request, next_uri)

        # Auth login verifies the test cookie is set
        request.session.set_test_cookie()

        # Single org mode -- send them to the org-specific handler
        if settings.SENTRY_SINGLE_ORGANIZATION:
            org = Organization.get_default()
            return Response({"nextUri": reverse("sentry-auth-organization", args=[org.slug])})

        session_expired = "session_expired" in request.COOKIES
        payload = self.prepare_login_context(request, *args, **kwargs)
        response = Response(payload)

        if session_expired:
            response.delete_cookie("session_expired")

        return response

    def respond_authenticated(self, request: Request):
        next_uri = self.get_next_uri(request)

        if not is_valid_redirect(next_uri, allowed_hosts=(request.get_host(),)):
            next_uri = get_org_redirect_url(
                request, self.active_organization.organization if self.active_organization else None
            )

        return Response({"nextUri": next_uri})

    def get_next_uri(self, request: HttpRequest) -> str:
        next_uri_fallback = request.session.pop("_next", None)
        return request.GET.get(REDIRECT_FIELD_NAME, next_uri_fallback)

    def prepare_login_context(self, request: Request, *args, **kwargs) -> AuthConfigResponse:
        can_register = bool(has_user_registration() or request.session.get("can_register"))

        context: dict[str, object] = {
            "serverHostname": get_server_hostname(),
            "canRegister": can_register,
            "hasNewsletter": newsletter.backend.is_enabled(),
            "pendingMfa": None,
        }

        if "session_expired" in request.COOKIES:
            context["warning"] = str(WARN_SESSION_EXPIRED)

        context.update(additional_context.run_callbacks(request))

        return cast(AuthConfigResponse, context)
