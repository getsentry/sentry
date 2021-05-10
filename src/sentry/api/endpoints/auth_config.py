from django.conf import settings
from django.contrib.auth import REDIRECT_FIELD_NAME
from django.urls import reverse
from rest_framework.response import Response

from sentry import newsletter
from sentry.api.base import Endpoint
from sentry.auth.superuser import is_active_superuser
from sentry.constants import WARN_SESSION_EXPIRED
from sentry.http import get_server_hostname
from sentry.models import Organization
from sentry.utils import auth
from sentry.web.frontend.auth_login import additional_context
from sentry.web.frontend.base import OrganizationMixin


class AuthConfigEndpoint(Endpoint, OrganizationMixin):
    # Disable authentication and permission requirements.
    permission_classes = []

    def get(self, request, *args, **kwargs):
        """
        Get context required to show a login page. Registration is handled elsewhere.
        """
        if request.user.is_authenticated:
            # if the user is a superuser, but not 'superuser authenticated' we
            # allow them to re-authenticate to gain superuser status
            if not request.user.is_superuser or is_active_superuser(request):
                return self.respond_authenticated(request)

        next_uri = self.get_next_uri(request)

        # we always reset the state on GET so you dont end up at an odd location
        auth.initiate_login(request, next_uri)

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

    def respond_authenticated(self, request):
        next_uri = self.get_next_uri(request)

        if not auth.is_valid_redirect(next_uri, host=request.get_host()):
            active_org = self.get_active_organization(request)
            next_uri = auth.get_org_redirect_url(request, active_org)

        return Response({"nextUri": next_uri})

    def get_next_uri(self, request):
        next_uri_fallback = None
        if request.session.get("_next") is not None:
            next_uri_fallback = request.session.pop("_next")
        return request.GET.get(REDIRECT_FIELD_NAME, next_uri_fallback)

    def prepare_login_context(self, request, *args, **kwargs):
        can_register = bool(auth.has_user_registration() or request.session.get("can_register"))

        context = {
            "serverHostname": get_server_hostname(),
            "canRegister": can_register,
            "hasNewsletter": newsletter.is_enabled(),
        }

        if "session_expired" in request.COOKIES:
            context["warning"] = WARN_SESSION_EXPIRED

        context.update(additional_context.run_callbacks(request))

        return context
