from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.issues.grouptype import GroupCategory
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.types import QueryBuilderConfig, SnubaParams
from sentry.services import eventstore
from sentry.services.eventstore.models import Event
from sentry.snuba.dataset import Dataset
from sentry.snuba.occurrences_rpc import Occurrences
from sentry.utils.validators import normalize_event_id

if TYPE_CHECKING:
    from sentry.models.group import Group

logger = logging.getLogger(__name__)


def get_direct_hit_response(
    request: Request,
    query: str | None,
    snuba_params: SnubaParams,
    referrer: str,
    group: Group,
) -> Response | None:
    """
    Checks whether a query is a direct hit for an event, and if so returns
    a response. Otherwise returns None
    """
    event_id = normalize_event_id(query)
    if event_id:
        data = run_group_events_query(
            query=f"id:{event_id}",
            snuba_params=snuba_params,
            group=group,
            limit=5,
            offset=0,
            orderby=None,
            referrer=referrer,
        )
        results = [
            Event(
                event_id=event_id,
                project_id=evt["project.id"],
            )
            for evt in data
        ]
        eventstore.backend.bind_nodes(results)

        if len(results) == 1:
            response = Response(serialize(results, request.user))
            response["X-Sentry-Direct-Hit"] = "1"
            return response
    return None


def get_query_builder_for_group(
    query: str,
    snuba_params: SnubaParams,
    group: Group,
    limit: int,
    offset: int,
    orderby: str | None = None,
) -> DiscoverQueryBuilder:
    dataset = Dataset.IssuePlatform
    if group.issue_category == GroupCategory.ERROR:
        dataset = Dataset.Events
    selected_columns = ["id", "project.id", "issue.id", "timestamp"]

    if orderby is None:
        orderby = "-timestamp"
    elif orderby == "sample":
        # IDs are UUIDs, so should be random, but we'll hash them just in case
        selected_columns.append("column_hash(id) as sample")

    return DiscoverQueryBuilder(
        dataset=dataset,
        query=f"issue:{group.qualified_short_id} {query}",
        params={},
        snuba_params=snuba_params,
        selected_columns=selected_columns,
        orderby=[orderby],
        limit=limit,
        offset=offset,
        config=QueryBuilderConfig(
            functions_acl=["column_hash"],
        ),
    )


def get_events_for_group_eap(
    query: str,
    snuba_params: SnubaParams,
    group: Group,
    limit: int,
    offset: int,
    orderby: str | None,
    referrer: str,
) -> list[dict[str, Any]]:
    query_string = f"group_id:{group.id}"
    if query:
        query_string = f"{query_string} {query}"

    if orderby is None or orderby == "sample":
        orderby_list = ["-timestamp"]
    else:
        orderby_list = [orderby]

    try:
        result = Occurrences.run_table_query(
            params=snuba_params,
            query_string=query_string,
            selected_columns=["id", "project_id", "group_id", "timestamp"],
            orderby=orderby_list,
            offset=offset,
            limit=limit,
            referrer=referrer,
            config=SearchResolverConfig(),
        )

        return [
            {
                "id": row.get("id"),
                "project.id": row.get("project_id"),
                "issue.id": row.get("group_id"),
                "timestamp": row.get("timestamp"),
            }
            for row in result.get("data", [])
        ]
    except Exception:
        logger.exception(
            "EAP query failed for group events",
            extra={
                "group_id": group.id,
                "referrer": referrer,
            },
        )
        return []


def run_group_events_query(
    query: str,
    snuba_params: SnubaParams,
    group: Group,
    limit: int,
    offset: int,
    orderby: str | None,
    referrer: str,
) -> list[dict[str, Any]]:
    snuba_query = get_query_builder_for_group(
        query=query,
        snuba_params=snuba_params,
        group=group,
        limit=limit,
        offset=offset,
        orderby=orderby,
    )
    snuba_result = snuba_query.run_query(referrer=referrer)
    snuba_data = snuba_result.get("data", [])

    results = snuba_data

    callsite = "api.helpers.events.run_group_events_query"
    if EAPOccurrencesComparator.should_check_experiment(callsite):
        eap_data = get_events_for_group_eap(
            query=query,
            snuba_params=snuba_params,
            group=group,
            limit=limit,
            offset=offset,
            orderby=orderby,
            referrer=referrer,
        )
        results = EAPOccurrencesComparator.check_and_choose(
            snuba_data,
            eap_data,
            callsite,
            is_experimental_data_a_null_result=len(eap_data) == 0,
            reasonable_match_comparator=_reasonable_group_events_match,
        )

    return results


def _reasonable_group_events_match(
    snuba_data: list[dict[str, Any]],
    eap_data: list[dict[str, Any]],
) -> bool:
    snuba_ids = {row.get("id") for row in snuba_data}
    eap_ids = {row.get("id") for row in eap_data}

    return eap_ids.issubset(snuba_ids)
