from __future__ import absolute_import

from sentry.auth import manager
from sentry.models import AuthProvider, OrganizationMemberType
from sentry.web.frontend.base import OrganizationView


class OrganizationAuthSettingsView(OrganizationView):
    required_access = OrganizationMemberType.OWNER

    def handle_existing_provider(self, request, organization):
        # at this point the provider may or may not be fully configured
        auth_provider = organization.auth_provider

        context = {
            'auth_provider': auth_provider,
        }

        return self.respond('sentry/organization-auth-provider-settings.html', context)

    def handle(self, request, organization):
        if organization.auth_provider:
            return self.handle_existing_provider(request, organization)

        if request.method == 'POST':
            provider = request.POST.get('provider')
            if manager.get(provider):
                organization.update(
                    auth_provider=AuthProvider.objects.create(
                        created_by=request.user,
                        provider=provider,
                    )
                )
                return self.handle_existing_provider(request, organization)

        context = {
            'provider_list': [(k, v.name) for k, v in manager],
        }

        return self.respond('sentry/organization-auth-settings.html', context)
