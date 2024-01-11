from __future__ import annotations

from typing import TYPE_CHECKING, Any, Mapping, Optional

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore
from sentry.api.serializers import serialize
from sentry.eventstore.models import Event
from sentry.issues.grouptype import GroupCategory
from sentry.search.events.builder import QueryBuilder
from sentry.snuba.dataset import Dataset
from sentry.utils.validators import normalize_event_id

if TYPE_CHECKING:
    from sentry.models.group import Group


def get_direct_hit_response(
    request: Request,
    query: Optional[str],
    snuba_params: Mapping[str, Any],
    referrer: str,
    group: Group,
) -> Optional[Response]:
    """
    Checks whether a query is a direct hit for an event, and if so returns
    a response. Otherwise returns None
    """
    event_id = normalize_event_id(query)
    if event_id:
        snuba_query = get_query_builder_for_group(
            f"id:{event_id}", snuba_params, group, offset=0, limit=5
        )
        results = snuba_query.run_query(referrer=referrer)
        results = [
            Event(
                event_id=event_id,
                project_id=evt["project.id"],
            )
            for evt in results["data"]
        ]
        eventstore.backend.bind_nodes(results)

        if len(results) == 1:
            response = Response(serialize(results, request.user))
            response["X-Sentry-Direct-Hit"] = "1"
            return response
    return None


def get_query_builder_for_group(
    query: str, snuba_params: Mapping[str, Any], group: Group, limit: int, offset: int
) -> QueryBuilder:
    dataset = Dataset.IssuePlatform
    if group.issue_category == GroupCategory.ERROR:
        dataset = Dataset.Events
    return QueryBuilder(
        dataset=dataset,
        query=f"issue:{group.qualified_short_id} {query}",
        params=snuba_params,
        selected_columns=["id", "project.id", "issue.id", "timestamp"],
        orderby=["-timestamp"],
        limit=limit,
        offset=offset,
    )
