from __future__ import annotations

from collections import defaultdict
from typing import Any

from rest_framework import status
from rest_framework.response import Response
from snuba_sdk import Request

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization_events import OrganizationEventsV2EndpointBase
from sentry.api.event_search import parse_search_query
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Organization
from sentry.replays.query import query_replays_count
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.types import ParamsType, SnubaParams
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.snuba import Dataset

MAX_REPLAY_COUNT = 51
MAX_VALS_PROVIDED = {
    "issue.id": 25,
    "transaction": 25,
    "replay_id": 100,
}


@region_silo_endpoint
class OrganizationReplayCountEndpoint(OrganizationEventsV2EndpointBase):
    """
    Get all the replay ids associated with a set of issues/transactions in discover,
    then verify that they exist in the replays dataset, and return the count.
    """

    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(20, 1),
            RateLimitCategory.USER: RateLimit(20, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(20, 1),
        }
    }

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:session-replay", organization, actor=request.user):
            return Response(status=404)

        try:
            snuba_params, params = self.get_snuba_dataclass(
                request, organization, check_global_views=False
            )
        except NoProjects:
            return Response({})

        try:
            replay_ids_mapping = get_replay_id_mappings(request, params, snuba_params)
        except (InvalidSearchQuery, ValueError) as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        replay_results = query_replays_count(
            project_ids=[p.id for p in snuba_params.projects],
            start=snuba_params.start,
            end=snuba_params.end,
            replay_ids=list(replay_ids_mapping.keys()),
            tenant_ids={"organization_id": organization.id},
        )

        if request.GET.get("returnIds"):
            return self.respond(get_replay_ids(replay_results, replay_ids_mapping))
        else:
            return self.respond(get_counts(replay_results, replay_ids_mapping))


def get_counts(replay_results: Any, replay_ids_mapping: dict[str, list[str]]) -> dict[str, int]:
    ret: dict[str, int] = defaultdict(int)
    for row in replay_results["data"]:
        identifiers = replay_ids_mapping[row["replay_id"]]
        for identifier in identifiers:
            ret[identifier] = min(ret[identifier] + 1, MAX_REPLAY_COUNT)
    return ret


def get_replay_ids(
    replay_results: Any, replay_ids_mapping: dict[str, list[str]]
) -> dict[str, list[str]]:
    ret: dict[str, list[str]] = defaultdict(list)
    for row in replay_results["data"]:
        identifiers = replay_ids_mapping[row["replay_id"]]
        for identifier in identifiers:
            if len(ret[identifier]) < MAX_REPLAY_COUNT:
                ret[identifier].append(row["replay_id"])
    return ret


def get_replay_id_mappings(
    request: Request, params: ParamsType, snuba_params: SnubaParams
) -> dict[str, list[str]]:

    select_column, value = get_select_column(request.GET.get("query"))

    if select_column == "replay_id":
        # just return a mapping of replay_id:replay_id instead of hitting discover
        # if we want to validate list of replay_ids existence
        return {v: [v] for v in value}

    builder = QueryBuilder(
        dataset=Dataset.Discover,
        params=params,
        snuba_params=snuba_params,
        selected_columns=["group_uniq_array(100,replayId)", select_column],
        query=request.GET.get("query"),
        limit=25,
        offset=0,
        functions_acl=["group_uniq_array"],
    )

    discover_results = builder.run_query(
        referrer="api.organization-issue-replay-count", use_cache=True
    )

    replay_id_to_issue_map = defaultdict(list)

    for row in discover_results["data"]:
        for replay_id in row["group_uniq_array_100_replayId"]:
            replay_id_to_issue_map[replay_id].append(row[select_column])

    return replay_id_to_issue_map


def get_select_column(query: str) -> tuple[str, list[Any]]:
    parsed_query = parse_search_query(query)

    select_column_conditions = [
        cond for cond in parsed_query if cond.key.name in ["issue.id", "transaction", "replay_id"]
    ]

    if len(select_column_conditions) > 1:
        raise ValueError("Must provide only one of: issue.id, transaction, replay_id")

    if len(select_column_conditions) == 0:
        raise ValueError("Must provide at least one issue.id, transaction, or replay_id")

    condition = select_column_conditions[0]

    if len(condition.value.raw_value) > MAX_VALS_PROVIDED[condition.key.name]:
        raise ValueError("Too many values provided")

    return condition.key.name, condition.value.raw_value
