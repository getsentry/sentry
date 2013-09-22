"""
sentry.web.frontend.projects
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.contrib import messages
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect
from django.utils.translation import ugettext_lazy as _

from sentry.constants import MEMBER_OWNER, STATUS_HIDDEN
from sentry.models import Project
from sentry.permissions import can_remove_project
from sentry.web.decorators import has_access
from sentry.web.forms.projects import RemoveProjectForm
from sentry.web.helpers import render_to_response


@has_access(MEMBER_OWNER)
@csrf_protect
def remove_project(request, team, project):
    if not can_remove_project(request.user, project):
        return HttpResponseRedirect(reverse('sentry'))

    project_list = filter(lambda x: x != project, Project.objects.get_for_user(request.user))

    form = RemoveProjectForm(request.user, project_list, request.POST or None)

    if form.is_valid():
        removal_type = form.cleaned_data['removal_type']
        if removal_type == '1':
            from sentry.tasks.deletion import delete_project

            delete_project.delay(object_id=project.id)
            project.update(status=STATUS_HIDDEN)

            messages.add_message(
                request, messages.SUCCESS,
                _('Deletion has been queued and should occur shortly.'))
        elif removal_type == '2':
            new_project = form.cleaned_data['project']
            project.merge_to(new_project)
        elif removal_type == '3':
            project.update(status=STATUS_HIDDEN)
        else:
            raise ValueError(removal_type)

        return HttpResponseRedirect(reverse('sentry-manage-team-projects', args=[project.team.slug]))

    context = csrf(request)
    context.update({
        'team': team,
        'form': form,
        'project': project,
    })

    return render_to_response('sentry/projects/remove.html', context, request)
