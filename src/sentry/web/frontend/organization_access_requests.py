from __future__ import absolute_import

from sentry.models import (
    OrganizationAccessRequest, OrganizationMemberType
)
from sentry.web.frontend.base import OrganizationView


class OrganizationAccessRequestsView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def get(self, request, organization):
        access_requests = OrganizationAccessRequest.objects.filter(
            team__organization=organization,
        ).select_related('team', 'user')

        context = {
            'request_list': list(access_requests),
        }

        return self.respond('sentry/organization-access-requests.html', context)
