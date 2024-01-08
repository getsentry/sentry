from __future__ import annotations

import dataclasses
from collections import defaultdict
from collections.abc import Sequence
from typing import Any

from sentry.api.event_search import parse_search_query
from sentry.models.group import Group
from sentry.replays.query import query_replays_count
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.types import QueryBuilderConfig, SnubaParams
from sentry.snuba.dataset import Dataset

MAX_REPLAY_COUNT = 51
MAX_VALS_PROVIDED = {
    "issue.id": 25,
    "transaction": 25,
    "replay_id": 100,
}

FILTER_HAS_A_REPLAY = " AND !replayId:''"


def get_replay_counts(snuba_params: SnubaParams, query, return_ids, data_source) -> dict[str, Any]:
    if snuba_params.start is None or snuba_params.end is None or snuba_params.organization is None:
        raise ValueError("Must provide start and end")

    replay_ids_mapping = _get_replay_id_mappings(query, snuba_params, data_source)

    # It's not guaranteed that any results will be returned by this query. If the result-set
    # is empty exit early to save us a query.
    if not replay_ids_mapping:
        return {}

    replay_results = query_replays_count(
        project_ids=[p.id for p in snuba_params.projects],
        start=snuba_params.start,
        end=snuba_params.end,
        replay_ids=list(replay_ids_mapping.keys()),
        tenant_ids={"organization_id": snuba_params.organization.id},
    )

    if return_ids:
        return _get_replay_ids(replay_results, replay_ids_mapping)
    else:
        return _get_counts(replay_results, replay_ids_mapping)


def _get_replay_id_mappings(
    query, snuba_params, data_source=Dataset.Discover
) -> dict[str, list[str]]:
    select_column, value = _get_select_column(query)
    query = query + FILTER_HAS_A_REPLAY if data_source == Dataset.Discover else query

    if select_column == "replay_id":
        # just return a mapping of replay_id:replay_id instead of hitting discover
        # if we want to validate list of replay_ids existence
        return {v: [v] for v in value}

    # The client may or may not have narrowed the request by project-id. We have a
    # defined set of issue-ids and can efficiently look-up their project-ids if the
    # client did not provide them. This optimization saves a significant amount of
    # time and memory when querying ClickHouse.
    #
    # NOTE: Possible to skip this. If the client did not set project_id = -1 then
    # we could trust the client narrowed the project-ids correctly. However, this
    # safety check is inexpensive and bad-actors (or malfunctioning clients) could
    # provide every project_id manually.
    if select_column == "issue.id":
        groups = Group.objects.select_related("project").filter(
            project__organization_id=snuba_params.organization.id,
            id__in=value,
        )
        snuba_params = dataclasses.replace(
            snuba_params,
            projects=[group.project for group in groups],
        )

    builder = QueryBuilder(
        dataset=data_source,
        params={},
        snuba_params=snuba_params,
        selected_columns=["group_uniq_array(100,replayId)", select_column],
        query=query,
        limit=25,
        offset=0,
        config=QueryBuilderConfig(
            functions_acl=["group_uniq_array"],
        ),
    )

    discover_results = builder.run_query(
        referrer="api.organization-issue-replay-count", use_cache=True
    )

    replay_id_to_issue_map = defaultdict(list)

    for row in discover_results["data"]:
        for replay_id in row["group_uniq_array_100_replayId"]:
            # When no replay exists these strings are provided in their empty
            # state rather than null. This can cause downstream problems so
            # we filter them out.
            if replay_id != "":
                replay_id_to_issue_map[replay_id].append(row[select_column])

    return replay_id_to_issue_map


def _get_counts(replay_results: Any, replay_ids_mapping: dict[str, list[str]]) -> dict[str, int]:
    ret: dict[str, int] = defaultdict(int)
    for row in replay_results["data"]:
        identifiers = replay_ids_mapping[row["rid"]]
        for identifier in identifiers:
            ret[identifier] = min(ret[identifier] + 1, MAX_REPLAY_COUNT)
    return ret


def _get_replay_ids(
    replay_results: Any, replay_ids_mapping: dict[str, list[str]]
) -> dict[str, list[str]]:
    ret: dict[str, list[str]] = defaultdict(list)
    for row in replay_results["data"]:
        identifiers = replay_ids_mapping[row["rid"]]
        for identifier in identifiers:
            if len(ret[identifier]) < MAX_REPLAY_COUNT:
                ret[identifier].append(row["rid"])
    return ret


def _get_select_column(query: str) -> tuple[str, Sequence[Any]]:
    parsed_query = parse_search_query(query)

    select_column_conditions = [
        cond for cond in parsed_query if cond.key.name in ["issue.id", "transaction", "replay_id"]
    ]

    if len(select_column_conditions) > 1:
        raise ValueError("Must provide only one of: issue.id, transaction, replay_id")

    if len(select_column_conditions) == 0:
        raise ValueError("Must provide at least one issue.id, transaction, or replay_id")

    condition = select_column_conditions[0]

    if not isinstance(condition.value.raw_value, Sequence) or isinstance(
        condition.value.raw_value, str
    ):
        raise ValueError("Condition value must be a list of strings")

    if len(condition.value.raw_value) > MAX_VALS_PROVIDED[condition.key.name]:
        raise ValueError("Too many values provided")

    return condition.key.name, condition.value.raw_value
