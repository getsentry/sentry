from __future__ import absolute_import

import six

from django.db.models import Q
from operator import or_
from six.moves import reduce

from sentry.api.base import DocSection
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.api.paginator import DateTimePaginator
from sentry.models import Event, EventTag, Group, TagKey, TagValue
from sentry.search.utils import parse_query
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('ListAvailableSamples')
def list_available_samples_scenario(runner):
    group = Group.objects.filter(project=runner.default_project).first()
    runner.request(
        method='GET',
        path='/issues/%s/events/' % group.id
    )


class GroupEventsEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    def _tags_to_filter(self, group, tags):
        project = group.project
        tagkeys = dict(TagKey.objects.filter(
            project=project,
            key__in=tags.keys(),
        ).values_list('key', 'id'))

        tagvalues = {
            (t[1], t[2]): t[0]
            for t in TagValue.objects.filter(
                reduce(or_, (Q(key=k, value=v) for k, v in six.iteritems(tags))),
                project=project,
            ).values_list('id', 'key', 'value')
        }

        try:
            tag_lookups = [
                (tagkeys[k], tagvalues[(k, v)])
                for k, v in six.iteritems(tags)
            ]
        except KeyError:
            # one or more tags were invalid, thus the result should be an empty
            # set
            return []

        # Django doesnt support union, so we limit results and try to find
        # reasonable matches

        # get initial matches to start the filter
        k, v = tag_lookups.pop()
        matches = list(EventTag.objects.filter(
            key_id=k,
            value_id=v,
            group_id=group.id,
        ).values_list('event_id', flat=True)[:1000])

        # for each remaining tag, find matches contained in our
        # existing set, pruning it down each iteration
        for k, v in tag_lookups:
            matches = list(EventTag.objects.filter(
                key_id=k,
                value_id=v,
                event_id__in=matches,
                group_id=group.id,
            ).values_list('event_id', flat=True)[:1000])
            if not matches:
                return []
        return matches

    @attach_scenarios([list_available_samples_scenario])
    def get(self, request, group):
        """
        List an Issue's Events
        ``````````````````````

        This endpoint lists an issue's events.

        :pparam string issue_id: the ID of the issue to retrieve.
        :auth: required
        """

        events = Event.objects.filter(
            group_id=group.id,
        )

        query = request.GET.get('query')
        if query:
            query_kwargs = parse_query(group.project, query, request.user)

            if query_kwargs['query']:
                events = events.filter(
                    message__icontains=query_kwargs['query'],
                )

            if query_kwargs['tags']:
                matches = self._tags_to_filter(group, query_kwargs['tags'])
                if matches:
                    events = events.filter(
                        id__in=matches,
                    )
                else:
                    events = events.none()

        return self.paginate(
            request=request,
            queryset=events,
            order_by='-datetime',
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=DateTimePaginator,
        )
