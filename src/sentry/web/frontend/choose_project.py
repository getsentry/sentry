from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.shortcuts import redirect
from rest_framework.response import Response

from sentry.models import Team
from sentry.web.frontend.base import OrganizationView


class OrganizationProjectChooser(OrganizationView):
    required_scope = 'team:read'

    def handle(self, request, organization):
        teams = Team.objects.get_for_user(
            organization=organization,
            user=request.user,
            with_projects=True,
        )

        next_param = request.GET.get('next')
        next_options = {
            'install': 'settings/install/',
            'release-tracking': 'settings/release-tracking/',
            'issue-tracking': 'settings/issue-tracking/',
            'notifications': 'settings/notifications/'
        }

        if next_param in next_options:
            next_url = next_options[next_param]
        else:
            return Response({'detail': 'No next page found for next parameter: ' + next_param}, status=404)

        if len(teams) == 1 and len(teams[0][1]) == 1:
            project = teams[0][1][0]
            return redirect(reverse('sentry-stream', args=[organization.slug, project.slug]) + next_url)

        context = {
            'organization': organization,
            'teams': teams,
            'next': next_url,
        }
        return self.respond('sentry/choose-project.html', context)
