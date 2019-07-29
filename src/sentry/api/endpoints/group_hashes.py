from __future__ import absolute_import

import logging
from datetime import datetime
from functools import partial

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases import GroupEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import Group, GroupHash, Event
from sentry.tasks.unmerge import unmerge
from sentry.utils.apidocs import scenario, attach_scenarios
from sentry.utils.snuba import raw_query


@scenario('ListAvailableHashes')
def list_available_hashes_scenario(runner):
    group = Group.objects.filter(project=runner.default_project).first()
    runner.request(method='GET', path='/issues/%s/hashes/' % group.id)


logger = logging.getLogger(__name__)


class GroupHashesEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    @attach_scenarios([list_available_hashes_scenario])
    def get(self, request, group):
        """
        List an Issue's Hashes
        ``````````````````````

        This endpoint lists an issue's hashes, which are the generated
        checksums used to aggregate individual events.

        :pparam string issue_id: the ID of the issue to retrieve.
        :auth: required
        """

        aggregations = [
            ('argMax(event_id, timestamp)', None, 'event_id')
        ]

        filter_keys = {
            'project_id': [group.project_id],
            'group_id': [group.id]
        }

        data_fn = partial(
            lambda *args, **kwargs: raw_query(*args, **kwargs)['data'],
            start=datetime.utcfromtimestamp(0),  # will be clamped to project retention
            end=datetime.utcnow(),  # will be clamped to project retention
            aggregations=aggregations,
            filter_keys=filter_keys,
            selected_columns=['primary_hash'],
            groupby=['primary_hash'],
            referrer='api.group-hashes',
        )

        return self.paginate(
            request=request,
            on_results=lambda results: self.handle_results(results, group.project_id),
            paginator=GenericOffsetPaginator(data_fn=data_fn)
        )

    def delete(self, request, group):
        id_list = request.GET.getlist('id')
        if id_list is None:
            return Response()

        hash_list = GroupHash.objects.filter(
            project_id=group.project_id,
            group=group.id,
            hash__in=id_list,
        ).exclude(
            state=GroupHash.State.LOCKED_IN_MIGRATION,
        ).values_list(
            'hash', flat=True
        )
        if not hash_list:
            return Response()

        unmerge.delay(
            group.project_id,
            group.id,
            None,
            hash_list,
            request.user.id if request.user else None,
        )

        return Response(status=202)

    def handle_results(self, results, project_id):
        event_ids = map(lambda result: result['event_id'], results)
        event_by_event_id = {
            event.event_id: event
            for event in Event.objects.filter(
                project_id=project_id,
                event_id__in=filter(None, event_ids),
            )
        }

        response = [self.handle_result(result['primary_hash'],
                                       event_by_event_id[result['event_id']]) for result in results]
        return response

    def handle_result(self, primary_hash, event):
        return {
            'id': primary_hash,
            'latestEvent': serialize(event)
        }
