from __future__ import absolute_import

from sentry.models import ApiKey, OrganizationMemberType
from sentry.web.frontend.base import OrganizationView


class OrganizationApiKeysView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def handle(self, request, organization):
        key_list = sorted(ApiKey.objects.filter(
            organization=organization,
        ), key=lambda x: x.label)

        context = {
            'key_list': key_list,
        }

        return self.respond('sentry/organization-api-keys.html', context)
