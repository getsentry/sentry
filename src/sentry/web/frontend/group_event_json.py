from __future__ import absolute_import, division

from django.http import Http404, HttpResponse

from sentry import options
from sentry.models import Event, SnubaEvent, Group, GroupMeta, get_group_with_redirect
from sentry.utils import json
from sentry.web.frontend.base import OrganizationView


class GroupEventJsonView(OrganizationView):
    required_scope = 'event:read'

    def get(self, request, organization, group_id, event_id_or_latest):
        use_snuba = options.get('snuba.events-queries.enabled')

        try:
            # TODO(tkaemming): This should *actually* redirect, see similar
            # comment in ``GroupEndpoint.convert_args``.
            group, _ = get_group_with_redirect(
                group_id,
            )
        except Group.DoesNotExist:
            raise Http404

        if event_id_or_latest == 'latest':
            # It's possible that a message would not be created under certain
            # circumstances (such as a post_save signal failing)
            event = group.get_latest_event() or Event(group=group)
        else:
            event_cls = SnubaEvent if use_snuba else Event
            event = event_cls.objects.from_event_id(event_id_or_latest, group.project.id)

        if event is None or (event.group_id != int(group_id)):
            raise Http404

        Event.objects.bind_nodes([event], 'data')

        GroupMeta.objects.populate_cache([group])

        return HttpResponse(json.dumps(event.as_dict()), content_type='application/json')
