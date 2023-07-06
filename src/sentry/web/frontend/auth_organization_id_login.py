from django.urls import reverse
from django.views.decorators.cache import never_cache

from sentry.services.hybrid_cloud.organization import organization_service
from sentry.utils.auth import is_valid_redirect
from sentry.web.frontend.auth_organization_login import AuthOrganizationLoginView


class AuthOrganizationIdentifierLoginView(AuthOrganizationLoginView):
    @never_cache
    def handle(self, request, organization_id):
        organization_context = organization_service.get_organization_by_id(
            id=organization_id,
        )

        if organization_context is None:
            return self.redirect(reverse("sentry-login"))

        if request.user.is_authenticated:
            next_uri = self.get_next_uri(request)
            if is_valid_redirect(next_uri, allowed_hosts=(request.get_host())):
                return self.redirect(next_uri)
            return self.redirect(reverse("issues"))

        return self.redirect(
            reverse("sentry-auth-organization", args=[organization_context.organization.slug])
        )
