from __future__ import annotations

from typing import TYPE_CHECKING, Any, Mapping, Optional, Tuple

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore
from sentry.api.serializers import serialize
from sentry.issues.query import apply_performance_conditions
from sentry.search.events.filter import get_filter
from sentry.snuba.dataset import Dataset
from sentry.types.issues import GroupCategory
from sentry.utils.validators import normalize_event_id

if TYPE_CHECKING:
    from sentry.eventstore import Filter
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
        snuba_filter, dataset = get_filter_for_group(f"id:{event_id}", snuba_params, group)
        results = eventstore.get_events(referrer=referrer, filter=snuba_filter, dataset=dataset)

        if len(results) == 1:
            response = Response(serialize(results, request.user))
            response["X-Sentry-Direct-Hit"] = "1"
            return response
    return None


def get_filter_for_group(
    query: str, snuba_params: Mapping[str, Any], group: Group
) -> Tuple[Filter, Dataset]:
    snuba_filter = get_filter(query=query, params=snuba_params)
    dataset = Dataset.Events
    if group.issue_category == GroupCategory.ERROR:
        snuba_filter.group_ids = [group.id]
    elif group.issue_category == GroupCategory.PERFORMANCE:
        dataset = Dataset.Transactions
        apply_performance_conditions(snuba_filter.conditions, group)

    return snuba_filter, dataset
