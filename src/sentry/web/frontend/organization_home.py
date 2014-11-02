from __future__ import absolute_import

from sentry.models import Team
from sentry.web.frontend.base import OrganizationView


class OrganizationHomeView(OrganizationView):
    def get(self, request, organization):
        team_list = Team.objects.get_for_user(
            organization=organization,
            user=request.user,
            with_projects=True,
        )

        context = {
            'team_list': team_list,
        }

        return self.respond('sentry/organization-home.html', context)
