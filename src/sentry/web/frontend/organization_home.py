from __future__ import absolute_import

from sentry.models import Team
from sentry.web.frontend.base import OrganizationView


class OrganizationHomeView(OrganizationView):
    def get(self, request, organization):
        active_teams = Team.objects.get_for_user(
            organization=organization,
            user=request.user,
            with_projects=True,
        )

        active_team_set = set([t.id for t, _ in active_teams])

        all_teams = []
        for team in Team.objects.filter(organization=organization).order_by('name'):
            all_teams.append((team, team.id in active_team_set))

        context = {
            'active_teams': active_teams,
            'all_teams': all_teams,
        }

        return self.respond('sentry/organization-home.html', context)
