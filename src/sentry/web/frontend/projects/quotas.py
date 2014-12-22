"""
sentry.web.frontend.projects
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.contrib import messages
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry import app
from sentry.constants import MEMBER_ADMIN
from sentry.web.decorators import has_access
from sentry.web.forms.projects import ProjectQuotasForm
from sentry.web.helpers import render_to_response


@has_access(MEMBER_ADMIN)
def manage_project_quotas(request, organization, project):
    from sentry.quotas.base import Quota

    form = ProjectQuotasForm(project, request.POST or None)

    if form and form.is_valid():
        form.save()

        messages.add_message(
            request, messages.SUCCESS,
            _('Your settings were saved successfully.'))

        return HttpResponseRedirect(reverse('sentry-manage-project-quotas', args=[project.organization.slug, project.slug]))

    context = {
        'organization': organization,
        'team': project.team,
        'page': 'quotas',
        # TODO(dcramer): has_quotas is an awful hack
        'has_quotas': type(app.quotas) != Quota,
        'system_quota': int(app.quotas.get_system_quota()),
        'team_quota': int(app.quotas.get_team_quota(project.team)),
        'project': project,
        'form': form,
    }
    return render_to_response('sentry/projects/quotas.html', context, request)
