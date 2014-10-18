from __future__ import absolute_import

from sentry.models import OrganizationMemberType, Team
from sentry.web.frontend.base import OrganizationView


class OrganizationTeamsView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def get(self, request, organization):
        context = {
            'team_list': Team.objects.filter(organization=organization),
        }

        return self.respond('sentry/organization-teams.html', context)
