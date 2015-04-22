from __future__ import absolute_import

import logging

from django.contrib import messages
from django.http import HttpResponseRedirect

from sentry.api import client
from sentry.models import OrganizationMember, Team
from sentry.web.frontend.base import OrganizationView


class OrganizationHomeView(OrganizationView):
    logger = logging.getLogger('sentry.api')

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

        if request.access.is_global:
            open_membership = True
        else:
            open_membership = bool(getattr(organization.flags, 'allow_joinleave'))

        context = {
            'active_teams': active_teams,
            'all_teams': all_teams,
            'open_membership': open_membership,
        }

        return self.respond('sentry/organization-home.html', context)

    def post(self, request, organization):
        op = request.POST.get('op')
        team = request.POST.get('team')

        om = OrganizationMember.objects.get(
            user=request.user,
            organization=organization,
        )

        if op == 'leave':
            try:
                client.delete('/organizations/{}/members/{}/teams/{}/'.format(
                    organization.slug, om.id, team,
                ), request.user)
            except client.ApiError as exc:
                self.logger.exception('Unable to remove member from team: %s', unicode(exc))
                messages.add_message(
                    request, messages.ERROR,
                    'We were unable to remove you from the team.',
                )
            else:
                messages.add_message(
                    request, messages.SUCCESS,
                    'Your team membership has been deactivated.',
                )
        elif op == 'join':
            try:
                resp = client.post('/organizations/{}/members/{}/teams/{}/'.format(
                    organization.slug, om.id, team,
                ), request.user)
            except client.ApiError as exc:
                self.logger.exception('Unable to add member from team: %s', unicode(exc))
                messages.add_message(
                    request, messages.ERROR,
                    'We were unable to join the team.',
                )
            else:
                if resp.status_code == 202:
                    messages.add_message(
                        request, messages.SUCCESS,
                        'A request has been sent to join the team.',
                    )
                else:
                    messages.add_message(
                        request, messages.SUCCESS,
                        'Your team membership has been activated.',
                    )
        return HttpResponseRedirect(request.path)
