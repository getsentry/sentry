from __future__ import absolute_import

from django.contrib import messages
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext_lazy as _

from sentry import app, features
from sentry.quotas.base import Quota
from sentry.web.forms.projects import ProjectQuotasForm
from sentry.web.frontend.base import ProjectView

ERR_NO_SSO = _('The quotas feature is not enabled for this project.')


class ProjectQuotasView(ProjectView):
    required_scope = 'project:write'

    def handle(self, request, organization, team, project):
        if not features.has('projects:quotas', project, actor=request.user):
            messages.add_message(
                request, messages.ERROR,
                ERR_NO_SSO,
            )
            redirect = reverse('sentry-manage-project',
                               args=[organization.slug, project.slug])
            return self.redirect(redirect)

        form = ProjectQuotasForm(project, request.POST or None)

        if form and form.is_valid():
            form.save()

            messages.add_message(
                request, messages.SUCCESS,
                _('Your settings were saved successfully.'))

            return self.redirect(reverse('sentry-manage-project-quotas', args=[project.organization.slug, project.slug]))

        context = {
            'organization': organization,
            'team': project.team,
            'page': 'quotas',
            # TODO(dcramer): has_quotas is an awful hack
            'has_quotas': type(app.quotas) != Quota,
            'organization_quota': int(app.quotas.get_organization_quota(project.organization)),
            'project': project,
            'form': form,
        }
        return self.respond('sentry/projects/quotas.html', context)
