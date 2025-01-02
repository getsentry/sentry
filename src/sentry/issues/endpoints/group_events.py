from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.environments import get_environments
from sentry.api.helpers.events import get_direct_hit_response, get_query_builder_for_group
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import EventSerializer, SimpleEventSerializer, serialize
from sentry.api.serializers.models.event import SimpleEventSerializerResponse
from sentry.api.utils import get_date_range_from_params
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.event_examples import EventExamples
from sentry.apidocs.parameters import EventParams, GlobalParams, IssueParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.eventstore.models import Event
from sentry.exceptions import InvalidParams, InvalidSearchQuery
from sentry.search.events.types import ParamsType
from sentry.search.utils import InvalidQuery, parse_query

if TYPE_CHECKING:
    from sentry.models.environment import Environment
    from sentry.models.group import Group


class NoResults(Exception):
    pass


class GroupEventsError(Exception):
    pass


@extend_schema(tags=["Events"])
@region_silo_endpoint
class GroupEventsEndpoint(GroupEndpoint, EnvironmentMixin):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ISSUES

    @extend_schema(
        operation_id="List an Issue's Events",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.ISSUE_ID,
            GlobalParams.START,
            GlobalParams.END,
            GlobalParams.STATS_PERIOD,
            GlobalParams.ENVIRONMENT,
            EventParams.FULL_PAYLOAD,
            EventParams.SAMPLE,
            EventParams.QUERY,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "GroupEventsResponseDict", list[SimpleEventSerializerResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=EventExamples.GROUP_EVENTS_SIMPLE,
    )
    def get(self, request: Request, group: Group) -> Response:
        """
        Return a list of error events bound to an issue
        """

        try:
            environments = get_environments(request, group.project.organization)
            query = self._get_search_query(request, group, environments)
        except InvalidQuery as exc:
            return Response({"detail": str(exc)}, status=400)
        except (NoResults, ResourceDoesNotExist):
            return Response([])

        try:
            start, end = get_date_range_from_params(request.GET, optional=True)
        except InvalidParams as e:
            raise ParseError(detail=str(e))

        try:
            return self._get_events_snuba(request, group, environments, query, start, end)
        except GroupEventsError as exc:
            raise ParseError(detail=str(exc))

    def _get_events_snuba(
        self,
        request: Request,
        group: Group,
        environments: Sequence[Environment],
        query: str | None,
        start: datetime | None,
        end: datetime | None,
    ) -> Response:
        default_end = timezone.now()
        default_start = default_end - timedelta(days=90)
        params: ParamsType = {
            "project_id": [group.project_id],
            "organization_id": group.project.organization_id,
            "start": start if start else default_start,
            "end": end if end else default_end,
        }
        referrer = f"api.group-events.{group.issue_category.name.lower()}"

        direct_hit_resp = get_direct_hit_response(
            request, query, params, f"{referrer}.direct-hit", group
        )
        if direct_hit_resp:
            return direct_hit_resp

        if environments:
            params["environment"] = [env.name for env in environments]

        full = request.GET.get("full") in ("1", "true")
        sample = request.GET.get("sample") in ("1", "true")

        if sample:
            orderby = "sample"
        else:
            orderby = None

        def data_fn(offset: int, limit: int) -> Any:
            try:
                snuba_query = get_query_builder_for_group(
                    request.GET.get("query", ""),
                    params,
                    group,
                    limit=limit,
                    offset=offset,
                    orderby=orderby,
                )
            except InvalidSearchQuery as e:
                raise ParseError(detail=str(e))
            results = snuba_query.run_query(referrer=referrer)
            results = [
                Event(
                    event_id=evt["id"],
                    project_id=evt["project.id"],
                    snuba_data={
                        "event_id": evt["id"],
                        "group_id": evt["issue.id"],
                        "project_id": evt["project.id"],
                        "timestamp": evt["timestamp"],
                    },
                )
                for evt in results["data"]
            ]
            if full:
                eventstore.backend.bind_nodes(results)

            return results

        serializer = EventSerializer() if full else SimpleEventSerializer()
        return self.paginate(
            request=request,
            on_results=lambda results: serialize(results, request.user, serializer),
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )

    def _get_search_query(
        self, request: Request, group: Group, environments: Sequence[Environment]
    ) -> str | None:
        raw_query = request.GET.get("query")

        if raw_query:
            query_kwargs = parse_query([group.project], raw_query, request.user, environments)
            query = query_kwargs.pop("query", None)
        else:
            query = None

        return query
