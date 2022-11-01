from django.contrib import messages
from django.db import transaction
from django.urls import reverse
from django.views.decorators.cache import never_cache
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.auth.helper import AuthHelper
from sentry.constants import WARN_SESSION_EXPIRED
from sentry.models import AuthProvider, Organization
from sentry.services.hybrid_cloud.organization import ApiOrganization, organization_service
from sentry.utils.auth import initiate_login
from sentry.web.frontend.auth_login import AuthLoginView


class AuthOrganizationLoginView(AuthLoginView):
    def respond_login(self, request: Request, context, *args, **kwargs) -> Response:
        return self.respond("sentry/organization-login.html", context)

    def handle_sso(self, request: Request, organization: ApiOrganization, auth_provider):
        if request.method == "POST":
            try:
                # TODO: This will need to go after pipeline refactor
                org = Organization.objects.get(organization.id)
            except Organization.NotFound:
                return self.redirect(reverse("sentry-login"))

            helper = AuthHelper(
                request=request,
                organization=org,
                auth_provider=auth_provider,
                flow=AuthHelper.FLOW_LOGIN,
            )

            if request.POST.get("init"):
                helper.initialize()

            if not helper.is_valid():
                return helper.error("Something unexpected happened during authentication.")

            return helper.current_step()

        provider = auth_provider.get_provider()

        context = {
            "CAN_REGISTER": False,
            "organization": organization,
            "provider_key": provider.key,
            "provider_name": provider.name,
            "authenticated": request.user.is_authenticated,
        }

        return self.respond("sentry/organization-login.html", context)

    @never_cache
    @transaction.atomic
    def handle(self, request: Request, organization_slug) -> Response:
        organization = organization_service.get_organization_by_slug(
            user_id=request.user.id, slug=organization_slug, only_visible=True
        )
        if organization is None:
            return self.redirect(reverse("sentry-login"))

        request.session.set_test_cookie()

        # check on POST to handle
        # multiple tabs case well now that we include redirect in url
        if request.method == "POST":
            next_uri = self.get_next_uri(request)
            initiate_login(request, next_uri)

        try:
            auth_provider = AuthProvider.objects.get(organization_id=organization.id)
        except AuthProvider.DoesNotExist:
            auth_provider = None

        session_expired = "session_expired" in request.COOKIES
        if session_expired:
            messages.add_message(request, messages.WARNING, WARN_SESSION_EXPIRED)

        if not auth_provider:
            response = self.handle_basic_auth(request, organization_id=organization.id)
        else:
            response = self.handle_sso(request, organization, auth_provider)

        if session_expired:
            response.delete_cookie("session_expired")

        return response
