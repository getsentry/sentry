"""
sentry.web.frontend.projects.keys
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.contrib import messages
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods
from django.utils.translation import ugettext_lazy as _

from sentry.constants import MEMBER_OWNER
from sentry.models import ProjectKey
from sentry.permissions import (
    can_remove_project_key, can_add_project_key
)
from sentry.plugins import plugins
from sentry.web.decorators import has_access
from sentry.web.helpers import render_to_response


@has_access(MEMBER_OWNER)
@csrf_protect
def manage_project_keys(request, team, project):
    result = plugins.first('has_perm', request.user, 'edit_project', project)
    if result is False and not request.user.has_perm('sentry.can_change_project'):
        return HttpResponseRedirect(reverse('sentry'))

    key_list = list(ProjectKey.objects.filter(
        project=project,
    ).select_related('user', 'user_added').order_by('-id'))

    for key in key_list:
        key.project = project
        key.can_remove = can_remove_project_key(request.user, key),

    context = csrf(request)
    context.update({
        'team': team,
        'page': 'keys',
        'project': project,
        'key_list': key_list,
        'can_add_key': can_add_project_key(request.user, project),
    })

    return render_to_response('sentry/projects/keys.html', context, request)


@has_access(MEMBER_OWNER)
@csrf_protect
def new_project_key(request, team, project):
    if not can_add_project_key(request.user, project):
        return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.team.slug, project.slug]))

    ProjectKey.objects.create(
        project=project,
        user_added=request.user,
    )

    return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.team.slug, project.slug]))


@require_http_methods(['POST'])
@has_access(MEMBER_OWNER)
@csrf_protect
def remove_project_key(request, team, project, key_id):
    try:
        key = ProjectKey.objects.get(id=key_id)
    except ProjectKey.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.team.slug, project.slug]))

    if not can_remove_project_key(request.user, key):
        return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.team.slug, project.slug]))

    key.delete()
    messages.add_message(
        request, messages.SUCCESS,
        _('The API key (%s) was revoked.') % (key.public_key,))

    return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.team.slug, project.slug]))
