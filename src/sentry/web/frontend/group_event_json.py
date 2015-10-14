from __future__ import absolute_import, division

from django.http import HttpResponse
from django.shortcuts import get_object_or_404

from sentry.models import Group, GroupMeta, Event
from sentry.utils import json
from sentry.web.frontend.base import ProjectView


class GroupEventJsonView(ProjectView):
    required_scope = 'event:read'

    def get(self, request, organization, project, team, group_id, event_id_or_latest):
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
