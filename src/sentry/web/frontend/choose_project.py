from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse
from django.shortcuts import redirect

from sentry.models import Project, Team
from sentry.web.frontend.base import OrganizationView
from sentry.utils.http import absolute_uri


class OrganizationProjectChooser(OrganizationView):
    required_scope = 'team:read'

    def handle(self, request, organization):
    	teams = Team.objects.get_for_user(
			organization=organization,
			user=request.user,
			with_projects=True,
			)

        # next_url should have a trailing slash only: settings/install/
        next_url = request.GET.get('next')
        if next_url[0] == '/':
            next_url = next_url[1:]
        if next_url[-1] != '/':
            next_url += '/'

        context = {
        	'organization': organization,
        	'teams': teams,
        	'next': next_url,
        }
        if len(teams) == 1 and len(teams[0][1]) == 1:
            return redirect('/' + organization.slug + '/' + teams[0][1][0].slug + '/' + next_url)

        return self.respond('sentry/choose-project.html', context)
