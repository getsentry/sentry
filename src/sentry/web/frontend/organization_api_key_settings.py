from __future__ import absolute_import

from sentry.models import ApiKey, OrganizationMemberType
from sentry.web.frontend.base import OrganizationView


class OrganizationApiKeySettingsView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def handle(self, request, organization, key_id):
        key = ApiKey.objects.get(organization=organization, id=key_id)

        context = {
            'key': key,
        }

        return self.respond('sentry/organization-api-key-settings.html', context)
