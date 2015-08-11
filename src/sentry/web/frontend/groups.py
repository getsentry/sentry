"""
sentry.web.frontend.groups
~~~~~~~~~~~~~~~~~~~~~~~~~~

Contains views for the "Events" section of Sentry.

TODO: Move all events.py views into here, and rename this file to events.

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, division

from django.core.urlresolvers import reverse
from django.http import (
    Http404, HttpResponse, HttpResponseRedirect
)
from django.shortcuts import get_object_or_404

from sentry.auth import access
from sentry.constants import MEMBER_USER
from sentry.models import (
    Project, Group, GroupMeta, Event
)
from sentry.plugins import plugins
from sentry.utils import json
from sentry.web.decorators import has_access, login_required
from sentry.web.helpers import render_to_response


@login_required
@has_access
def wall_display(request, organization, team):
    project_list = list(Project.objects.filter(team=team))

    for project in project_list:
        project.team = team

    return render_to_response('sentry/wall.html', {
        'team': team,
        'organization': team.organization,
        'project_list': project_list,
        'ACCESS': access.from_user(
            user=request.user,
            organization=organization,
        ).to_django_context(),
    }, request)


@has_access(MEMBER_USER)
def group_event_details_json(request, organization, project, group_id, event_id_or_latest):
    group = get_object_or_404(Group, pk=group_id, project=project)

    if event_id_or_latest == 'latest':
        # It's possible that a message would not be created under certain
        # circumstances (such as a post_save signal failing)
        event = group.get_latest_event() or Event(group=group)
    else:
        event = get_object_or_404(group.event_set, pk=event_id_or_latest)

    Event.objects.bind_nodes([event], 'data')
    GroupMeta.objects.populate_cache([group])

    return HttpResponse(json.dumps(event.as_dict()), mimetype='application/json')


@login_required
@has_access(MEMBER_USER)
def group_plugin_action(request, organization, project, group_id, slug):
    group = get_object_or_404(Group, pk=group_id, project=project)

    try:
        plugin = plugins.get(slug)
    except KeyError:
        raise Http404('Plugin not found')

    GroupMeta.objects.populate_cache([group])

    response = plugin.get_view_response(request, group)
    if response:
        return response

    redirect = request.META.get('HTTP_REFERER') or reverse('sentry-stream', kwargs={
        'organization_slug': organization.slug,
        'project_id': group.project.slug
    })
    return HttpResponseRedirect(redirect)
