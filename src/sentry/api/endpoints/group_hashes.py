from __future__ import absolute_import

from functools import partial

from rest_framework.response import Response

from sentry import eventstore
from sentry.api.base import DocSection
from sentry.api.bases import GroupEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import EventSerializer, serialize
from sentry.models import Group, GroupHash
from sentry.tasks.unmerge import unmerge
from sentry.utils.apidocs import scenario, attach_scenarios
from sentry.utils.snuba import raw_query


@scenario("ListAvailableHashes")
def list_available_hashes_scenario(runner):
    group = Group.objects.filter(project=runner.default_project).first()
    runner.request(method="GET", path="/issues/%s/hashes/" % group.id)


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

        data_fn = partial(
            lambda *args, **kwargs: raw_query(*args, **kwargs)["data"],
            aggregations=[
                ("argMax(event_id, timestamp)", None, "event_id"),
                ("max", "timestamp", "latest_event_timestamp"),
            ],
            filter_keys={"project_id": [group.project_id], "group_id": [group.id]},
            groupby=["primary_hash"],
            referrer="api.group-hashes",
            orderby=["-latest_event_timestamp"],
        )

        handle_results = partial(self.__handle_results, group.project_id, group.id, request.user)

        return self.paginate(
            request=request,
            on_results=handle_results,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )

    def delete(self, request, group):
        id_list = request.GET.getlist("id")
        if id_list is None:
            return Response()

        hash_list = (
            GroupHash.objects.filter(project_id=group.project_id, group=group.id, hash__in=id_list)
            .exclude(state=GroupHash.State.LOCKED_IN_MIGRATION)
            .values_list("hash", flat=True)
        )
        if not hash_list:
            return Response()

        unmerge.delay(
            group.project_id, group.id, None, hash_list, request.user.id if request.user else None
        )

        return Response(status=202)

    def __handle_results(self, project_id, group_id, user, results):
        return [self.__handle_result(user, project_id, group_id, result) for result in results]

    def __handle_result(self, user, project_id, group_id, result):
        event = eventstore.get_event_by_id(project_id, result["event_id"])

        return {
            "id": result["primary_hash"],
            "latestEvent": serialize(event, user, EventSerializer()),
        }
