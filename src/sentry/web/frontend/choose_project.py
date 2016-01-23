from __future__ import absolute_import

from django import forms
from django.contrib import messages
from django.core.urlresolvers import reverse

from sentry.models import Project, Team
from sentry.web.frontend.base import OrganizationView
from sentry.utils.http import absolute_uri


class OrganizationProjectChooser(OrganizationView):
    # TODO(dcramer): I'm 95% certain the access is incorrect here as it would
    # be probably validating against global org access, and all we care about is
    # team admin
    required_scope = 'team:read'


    def handle(self, request, organization):
    	teams = Team.objects.get_for_user(
			organization=organization,
			user=request.user,
			with_projects=True,
			)

        context = {
        	'organization': organization,
        	'teams': teams,
        	'next': request.GET.get('next') if 'next' in request.GET else '',
        }

        return self.respond('sentry/choose-project.html', context)
