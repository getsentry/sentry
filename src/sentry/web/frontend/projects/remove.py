"""
sentry.web.frontend.projects
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.contrib import messages
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect
from django.utils.translation import ugettext_lazy as _

from sentry.constants import MEMBER_OWNER, STATUS_HIDDEN
from sentry.permissions import can_remove_project
from sentry.tasks.deletion import delete_project
from sentry.web.decorators import has_access
from sentry.web.forms.projects import RemoveProjectForm
from sentry.web.helpers import render_to_response


@has_access(MEMBER_OWNER)
@csrf_protect
def remove_project(request, team, project):
    if not can_remove_project(request.user, project):
        return HttpResponseRedirect(reverse('sentry'))

    form = RemoveProjectForm(request.user, request.POST or None)

    if form.is_valid():
        if project.status != STATUS_HIDDEN:
            project.update(status=STATUS_HIDDEN)
            delete_project.delay(object_id=project.id)

        messages.add_message(
            request, messages.SUCCESS,
            _('Deletion has been queued and will happen automatically.'))

        return HttpResponseRedirect(reverse('sentry-manage-team-projects', args=[project.team.slug]))

    context = csrf(request)
    context.update({
        'team': team,
        'form': form,
        'project': project,
    })

    return render_to_response('sentry/projects/remove.html', context, request)
