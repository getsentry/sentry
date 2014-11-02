from __future__ import absolute_import

from sentry.models import OrganizationMemberType, Team
from sentry.web.frontend.base import OrganizationView


class OrganizationTeamsView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def get(self, request, organization):
        team_list = Team.objects.get_for_user(
            organization=organization,
            user=request.user,
        )

        context = {
            'team_list': team_list,
        }

        return self.respond('sentry/organization-teams.html', context)
