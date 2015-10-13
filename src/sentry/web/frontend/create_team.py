from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.web.forms.add_team import AddTeamForm
from sentry.web.frontend.base import OrganizationView


class CreateTeamView(OrganizationView):
    required_scope = 'team:write'

    def get_form(self, request):
        return AddTeamForm(request.POST or None, initial={
            'team': request.GET.get('team'),
        })

    def handle(self, request, organization):
        form = self.get_form(request)
        if form.is_valid():
            team = form.save(request.user, organization, request.META['REMOTE_ADDR'])

            url = '{}?team={}'.format(
                reverse('sentry-create-project', args=[organization.slug]),
                team.slug,
            )

            return self.redirect(url)

        context = {
            'form': form,
        }

        return self.respond('sentry/create-team.html', context)
