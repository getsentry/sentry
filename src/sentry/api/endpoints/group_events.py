from __future__ import annotations

from datetime import datetime, timedelta
from functools import partial
from typing import TYPE_CHECKING, Optional, Sequence, cast

from django.utils import timezone
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.environments import get_environments
from sentry.api.helpers.events import get_direct_hit_response, get_filter_for_group
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import EventSerializer, SimpleEventSerializer, serialize
from sentry.api.utils import InvalidParams, get_date_range_from_params
from sentry.exceptions import InvalidSearchQuery
from sentry.search.utils import InvalidQuery, parse_query

if TYPE_CHECKING:
    from sentry.models.group import Environment, Group


class NoResults(Exception):
    pass


class GroupEventsError(Exception):
    pass


@region_silo_endpoint
class GroupEventsEndpoint(GroupEndpoint, EnvironmentMixin):  # type: ignore
    def get(self, request: Request, group: Group) -> Response:
        """
        List an Issue's Events
        ``````````````````````

        This endpoint lists an issue's events.
        :qparam bool full: if this is set to true then the event payload will
                           include the full event body, including the stacktrace.
                           Set to 1 to enable.

        :pparam string issue_id: the ID of the issue to retrieve.

        :auth: required
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
        query: Optional[str],
        start: Optional[datetime],
        end: Optional[datetime],
    ) -> Response:
        default_end = timezone.now()
        default_start = default_end - timedelta(days=90)
        params = {
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

        try:
            snuba_filter, dataset = get_filter_for_group(
                request.GET.get("query", None), params, group
            )
        except InvalidSearchQuery as e:
            raise ParseError(detail=str(e))

        full = request.GET.get("full", False)
        data_fn = partial(
            eventstore.get_events if full else eventstore.get_unfetched_events,
            referrer=referrer,
            filter=snuba_filter,
            dataset=dataset,
        )
        serializer = EventSerializer() if full else SimpleEventSerializer()
        return self.paginate(
            request=request,
            on_results=lambda results: serialize(results, request.user, serializer),
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )

    def _get_search_query(
        self, request: Request, group: Group, environments: Sequence[Environment]
    ) -> Optional[str]:
        raw_query = request.GET.get("query")

        if raw_query:
            query_kwargs = parse_query([group.project], raw_query, request.user, environments)
            query = cast(str, query_kwargs.pop("query", None))
        else:
            query = None

        return query
