from django.conf import settings
from django.contrib.auth import REDIRECT_FIELD_NAME
from django.urls import reverse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import newsletter
from sentry.api.base import Endpoint
from sentry.constants import WARN_SESSION_EXPIRED
from sentry.http import get_server_hostname
from sentry.models import Organization
from sentry.utils.auth import (
    get_org_redirect_url,
    has_user_registration,
    initiate_login,
    is_valid_redirect,
)
from sentry.web.frontend.auth_login import additional_context
from sentry.web.frontend.base import OrganizationMixin


class AuthConfigEndpoint(Endpoint, OrganizationMixin):
    # Disable authentication and permission requirements.
    permission_classes = []

    def get(self, request: Request, *args, **kwargs) -> Response:
        """
        Get context required to show a login page. Registration is handled elsewhere.
        """
        if request.user.is_authenticated:
            return self.respond_authenticated(request)

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
            active_org = self.get_active_organization(request)
            next_uri = get_org_redirect_url(request, active_org)

        return Response({"nextUri": next_uri})

    def get_next_uri(self, request: Request):
        next_uri_fallback = None
        if request.session.get("_next") is not None:
            next_uri_fallback = request.session.pop("_next")
        return request.GET.get(REDIRECT_FIELD_NAME, next_uri_fallback)

    def prepare_login_context(self, request: Request, *args, **kwargs):
        can_register = bool(has_user_registration() or request.session.get("can_register"))

        context = {
            "serverHostname": get_server_hostname(),
            "canRegister": can_register,
            "hasNewsletter": newsletter.is_enabled(),
        }

        if "session_expired" in request.COOKIES:
            context["warning"] = WARN_SESSION_EXPIRED

        context.update(additional_context.run_callbacks(request))

        return context
