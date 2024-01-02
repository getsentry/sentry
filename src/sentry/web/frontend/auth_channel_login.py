from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache

from sentry.auth.helper import CHANNEL_PROVIDER_MAP
from sentry.models.authprovider import AuthProvider
from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.utils.auth import is_valid_redirect
from sentry.web.frontend.auth_organization_login import AuthOrganizationLoginView
from sentry.web.frontend.base import control_silo_view


@control_silo_view
class AuthChannelLoginView(AuthOrganizationLoginView):
    @method_decorator(never_cache)
    def handle(self, request, channel, resource_id):
        if request.subdomain is not None:
            return self.redirect(reverse("sentry-auth-organization", args=[request.subdomain]))

        config_data = request.GET.get("config_data", "")

        if not config_data:
            # NOTE: This provider_config may differ per provider
            # Allow providers to supply their own config_data, otherwise
            # construct one with the resource_id (NOT the sentry org id)
            provider = CHANNEL_PROVIDER_MAP[channel]
            config_data = provider.build_config(resource={"id": resource_id})

        # Checking for duplicate orgs
        auth_provider_model = AuthProvider.objects.filter(provider=channel, config=config_data)

        if not auth_provider_model.exists() or len(auth_provider_model) > 1:
            return self.redirect(reverse("sentry-login"))

        organization_id = auth_provider_model[0].organization_id
        try:
            slug = OrganizationMapping.objects.get(organization_id=organization_id).slug
        except OrganizationMapping.DoesNotExist:
            return self.redirect(reverse("sentry-login"))

        next_uri = self.get_next_uri(request)
        # If user has an active session within the same organization skip login
        if request.user.is_authenticated:
            if self.active_organization is not None:
                if self.active_organization.organization.id == organization_id:
                    if is_valid_redirect(next_uri, allowed_hosts=(request.get_host())):
                        return self.redirect(next_uri)
                    return self.redirect(Organization.get_url(slug=slug))

        # If user doesn't have active session within the same organization redirect to login for the
        # organization in the url
        org_auth_url = reverse("sentry-auth-organization", args=[slug])
        redirect_url = (
            org_auth_url + "?next=" + next_uri
            if is_valid_redirect(next_uri, allowed_hosts=(request.get_host()))
            else org_auth_url
        )
        return self.redirect(redirect_url)
