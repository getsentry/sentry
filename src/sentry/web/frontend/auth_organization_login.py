import logging

from django.contrib import messages
from django.contrib.auth import REDIRECT_FIELD_NAME
from django.http import HttpRequest, HttpResponseNotAllowed
from django.http.response import HttpResponseBase
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache

from sentry.auth.helper import AuthHelper
from sentry.auth.store import FLOW_LOGIN
from sentry.constants import WARN_SESSION_EXPIRED
from sentry.models.authprovider import AuthProvider
from sentry.organizations.services.organization import RpcOrganization, organization_service
from sentry.utils.auth import construct_link_with_query, initiate_login
from sentry.web.frontend.auth_login import AuthPageView

logger = logging.getLogger("sentry.saml_setup_error")


class AuthOrganizationLoginView(AuthPageView):
    def handle_sso(self, request: HttpRequest, organization: RpcOrganization, auth_provider):
        helper = AuthHelper(
            request=request,
            organization=organization,
            auth_provider=auth_provider,
            flow=FLOW_LOGIN,
            referrer=request.GET.get(
                "referrer"
            ),  # TODO: get referrer from the form submit - not the query parms
        )

        if request.POST.get("init"):
            helper.initialize()

        if not helper.is_valid():
            logger.info(
                "AuthOrganizationLoginView",
                extra=helper.state.get_state(),
            )
            return helper.error("Something unexpected happened during authentication.")

        return helper.current_step()

    @method_decorator(never_cache)
    def handle(self, request: HttpRequest, organization_slug) -> HttpResponseBase:
        if request.method == "GET":
            if (
                request.resolver_match
                and request.resolver_match.url_name == "sentry-auth-link-identity"
            ):
                path = reverse("sentry-auth-organization", args=[organization_slug])
                return self.redirect(construct_link_with_query(path, request.GET))

            customer_domain_redirect = self.get_customer_domain_login_redirect(request)
            if customer_domain_redirect is not None:
                return customer_domain_redirect

            return self.handle_react(request)

        if request.method != "POST":
            return HttpResponseNotAllowed(["GET", "POST"])

        org_context = organization_service.get_organization_by_slug(
            slug=organization_slug, only_visible=True
        )
        if org_context is None:
            return self.redirect(reverse("sentry-login"))
        organization = org_context.organization

        try:
            auth_provider = AuthProvider.objects.get(organization_id=organization.id)
        except AuthProvider.DoesNotExist:
            return self.redirect(request.get_full_path())

        request.session.set_test_cookie()
        referrer = request.session.pop("_referrer", None)
        next_uri = request.GET.get(REDIRECT_FIELD_NAME, request.session.pop("_next", None))
        initiate_login(request, next_uri, referrer)

        session_expired = "session_expired" in request.COOKIES
        if session_expired:
            messages.add_message(request, messages.WARNING, WARN_SESSION_EXPIRED)

        response = self.handle_sso(request, organization, auth_provider)

        if session_expired:
            response.delete_cookie("session_expired")

        return response
