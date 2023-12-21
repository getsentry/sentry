from functools import partial

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import EventSerializer, serialize
from sentry.models.grouphash import GroupHash
from sentry.tasks.unmerge import unmerge
from sentry.utils import metrics
from sentry.utils.snuba import raw_query


@region_silo_endpoint
class GroupHashesEndpoint(GroupEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, group) -> Response:
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
            tenant_ids={"organization_id": group.project.organization_id},
        )

        handle_results = partial(self.__handle_results, group.project_id, group.id, request.user)

        return self.paginate(
            request=request,
            on_results=handle_results,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )

    def delete(self, request: Request, group) -> Response:
        id_list = request.GET.getlist("id")
        if not id_list:
            return Response()

        hash_list = list(
            GroupHash.objects.filter(project_id=group.project_id, group=group.id, hash__in=id_list)
            .exclude(state=GroupHash.State.LOCKED_IN_MIGRATION)
            .values_list("hash", flat=True)
        )
        if not hash_list:
            # respond with an error that it's already being merged
            return Response({"detail": "Already being unmerged"}, status=409)

        metrics.incr(
            "grouping.unmerge_issues",
            sample_rate=1.0,
            # We assume that if someone's merged groups, they were all from the same platform
            tags={"platform": group.platform or "unknown", "sdk": group.sdk or "unknown"},
        )

        unmerge.delay(
            group.project_id, group.id, None, hash_list, request.user.id if request.user else None
        )

        return Response(status=202)

    def __handle_results(self, project_id, group_id, user, results):
        return [self.__handle_result(user, project_id, group_id, result) for result in results]

    def __handle_result(self, user, project_id, group_id, result):
        event = eventstore.backend.get_event_by_id(project_id, result["event_id"])

        return {
            "id": result["primary_hash"],
            "latestEvent": serialize(event, user, EventSerializer()),
        }
