from django.urls import reverse
from django.views.decorators.cache import never_cache

from sentry.auth.helper import CHANNEL_PROVIDER_MAP
from sentry.models.authprovider import AuthProvider
from sentry.models.organization import Organization
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.utils.auth import is_valid_redirect
from sentry.web.frontend.auth_organization_login import AuthOrganizationLoginView


class AuthChannelLoginView(AuthOrganizationLoginView):
    @never_cache
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
        organization_context = organization_service.get_organization_by_id(
            id=organization_id,
        )

        if organization_context is None:
            return self.redirect(reverse("sentry-login"))

        if request.user.is_authenticated:
            next_uri = self.get_next_uri(request)
            if is_valid_redirect(next_uri, allowed_hosts=(request.get_host())):
                return self.redirect(next_uri)
            return self.redirect(Organization.get_url(slug=organization_context.organization.slug))

        return self.redirect(
            reverse("sentry-auth-organization", args=[organization_context.organization.slug])
        )
