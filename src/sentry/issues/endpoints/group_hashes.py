from collections.abc import Sequence
from functools import partial
from typing import TypedDict

from django.contrib.auth.models import AnonymousUser
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import EventSerializer, SimpleEventSerializer, serialize
from sentry.api.serializers.models.event import (
    EventSerializerResponse,
    SimpleEventSerializerResponse,
)
from sentry.apidocs.constants import (
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.event_examples import EventExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, IssueParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.services import eventstore
from sentry.tasks.unmerge import start_unmerge
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils import metrics
from sentry.utils.snuba import raw_query


class GroupHashesResult(TypedDict):
    id: str
    latestEvent: EventSerializerResponse | SimpleEventSerializerResponse | None
    mergedBySeer: bool
    seerMatchDistance: float | None


@extend_schema(tags=["Events"])
@cell_silo_endpoint
class GroupHashesEndpoint(GroupEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "PUT": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="listOrganizationIssueHashes",
        summary="List an Issue's Hashes",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.ISSUE_ID,
            # This endpoint defaults `full` to True, unlike the shared
            # EventParams.FULL_PAYLOAD which siblings use with default=False.
            OpenApiParameter(
                name="full",
                type=OpenApiTypes.BOOL,
                location=OpenApiParameter.QUERY,
                required=False,
                default=True,
                description="Specify true to include the full event body, including the stacktrace, in the event payload.",
            ),
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer("GroupHashesResponse", list[GroupHashesResult]),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=EventExamples.GROUP_HASHES,
    )
    @deprecated(
        CELL_API_DEPRECATION_DATE,
        suggested_api="sentry-api-0-organization-group-group-hashes",
        url_names=["sentry-api-0-group-hashes"],
    )
    def get(self, request: Request, group: Group) -> Response[list[GroupHashesResult]]:
        """
        List the hashes that make up an issue. Each hash represents a grouping
        signature used to aggregate individual events into this issue.
        """
        full = request.GET.get("full") not in ("0", "false")

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

        handle_results = partial(
            self.__handle_results, group.project_id, group.id, request.user, full
        )

        return self.paginate(
            request=request,
            on_results=handle_results,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )

    @deprecated(
        CELL_API_DEPRECATION_DATE,
        suggested_api="sentry-api-0-organization-group-group-hashes",
        url_names=["sentry-api-0-group-hashes"],
    )
    def put(self, request: Request, group: Group) -> Response:
        """
        Perform an unmerge by reassigning events with hash values corresponding to the given
        grouphash ids from being part of the given group to being part of a new group.

        Note that if multiple grouphash ids are given, all their corresponding events will end up in
        a single new group together, rather than each hash's events ending in their own new group.
        """
        grouphash_ids = request.GET.getlist("id")
        if not grouphash_ids:
            return Response()

        grouphashes = list(
            GroupHash.objects.filter(
                project_id=group.project_id, group=group.id, hash__in=grouphash_ids
            )
            .exclude(state=GroupHash.State.LOCKED_IN_MIGRATION)
            .values_list("hash", flat=True)
        )
        if not grouphashes:
            return Response({"detail": "Already being unmerged"}, status=409)

        metrics.incr(
            "grouping.unmerge_issues",
            sample_rate=1.0,
            # We assume that if someone's merged groups, they were all from the same platform
            tags={"platform": group.platform or "unknown", "sdk": group.sdk or "unknown"},
        )

        start_unmerge.delay(
            group.project_id, group.id, None, grouphashes, request.user.id if request.user else None
        )

        return Response(status=202)

    def __handle_results(
        self,
        project_id: int,
        group_id: int,
        user: User | RpcUser | AnonymousUser | None,
        full: str | bool,
        results: Sequence[dict[str, str]],
    ) -> list[GroupHashesResult]:
        primary_hashes = [result["primary_hash"] for result in results]
        grouphashes = {
            grouphash.hash: grouphash
            for grouphash in GroupHash.objects.filter(
                project_id=project_id, group_id=group_id, hash__in=primary_hashes
            ).select_related("_metadata")
        }

        return [
            self.__handle_result(
                user, project_id, group_id, full, result, grouphashes.get(result["primary_hash"])
            )
            for result in results
        ]

    def __handle_result(
        self,
        user: User | RpcUser | AnonymousUser | None,
        project_id: int,
        group_id: int,
        full: str | bool,
        result: dict[str, str],
        grouphash: GroupHash | None = None,
    ) -> GroupHashesResult:
        event = eventstore.backend.get_event_by_id(project_id, result["event_id"])
        if grouphash and grouphash.metadata and grouphash.metadata.seer_matched_grouphash:
            merged_by_seer = True
            seer_match_distance = grouphash.metadata.seer_match_distance
        else:
            merged_by_seer = False
            seer_match_distance = None

        serializer = EventSerializer if full else SimpleEventSerializer
        response: GroupHashesResult = {
            "id": result["primary_hash"],
            "latestEvent": serialize(event, user, serializer()),
            "mergedBySeer": merged_by_seer,
            "seerMatchDistance": seer_match_distance,
        }

        return response
