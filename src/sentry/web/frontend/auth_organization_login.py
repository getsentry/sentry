from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse
from django.db import transaction
from django.views.decorators.cache import never_cache
from django.contrib import messages

from sentry.auth.helper import AuthHelper
from sentry.constants import WARN_SESSION_EXPIRED
from sentry.models import AuthProvider, Organization, OrganizationStatus
from sentry.web.frontend.auth_login import AuthLoginView


class AuthOrganizationLoginView(AuthLoginView):
    def respond_login(self, request, context, *args, **kwargs):
        return self.respond("sentry/organization-login.html", context)

    def handle_sso(self, request, organization, auth_provider):
        if request.method == "POST":
            helper = AuthHelper(
                request=request,
                organization=organization,
                auth_provider=auth_provider,
                flow=AuthHelper.FLOW_LOGIN,
            )

            if request.POST.get("init"):
                helper.init_pipeline()

            if not helper.pipeline_is_valid():
                return helper.error("Something unexpected happened during authentication.")

            return helper.current_step()

        provider = auth_provider.get_provider()

        context = {
            "CAN_REGISTER": False,
            "organization": organization,
            "provider_key": provider.key,
            "provider_name": provider.name,
            "authenticated": request.user.is_authenticated(),
        }

        return self.respond("sentry/organization-login.html", context)

    @never_cache
    @transaction.atomic
    def handle(self, request, organization_slug):
        try:
            organization = Organization.objects.get(slug=organization_slug)
        except Organization.DoesNotExist:
            return self.redirect(reverse("sentry-login"))

        if organization.status != OrganizationStatus.VISIBLE:
            return self.redirect(reverse("sentry-login"))

        request.session.set_test_cookie()

        try:
            auth_provider = AuthProvider.objects.get(organization=organization)
        except AuthProvider.DoesNotExist:
            auth_provider = None

        session_expired = "session_expired" in request.COOKIES
        if session_expired:
            messages.add_message(request, messages.WARNING, WARN_SESSION_EXPIRED)

        if not auth_provider:
            response = self.handle_basic_auth(request, organization=organization)
        else:
            response = self.handle_sso(request, organization, auth_provider)

        if session_expired:
            response.delete_cookie("session_expired")

        return response
