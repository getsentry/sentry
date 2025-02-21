from __future__ import annotations

import dataclasses
import uuid
from collections import defaultdict
from collections.abc import Generator, Sequence
from typing import Any

from sentry.api.event_search import ParenExpression, SearchFilter, parse_search_query
from sentry.models.group import Group
from sentry.replays.query import query_replays_count
from sentry.search.events.types import SnubaParams
from sentry.snuba import discover, issue_platform
from sentry.snuba.dataset import Dataset

MAX_REPLAY_COUNT = 51
MAX_VALS_PROVIDED = {
    "issue.id": 25,
    "transaction": 25,
    "replay_id": 100,
}

FILTER_HAS_A_REPLAY = ' AND !replay.id:""'


def get_replay_counts(
    snuba_params: SnubaParams, query: str, return_ids: bool, data_source: str | Dataset
) -> dict[str, Any]:
    """
    Queries snuba/clickhouse for replay count of each identifier (usually an issue or transaction).
    - Identifier is parsed from 'query' (select column), and 'snuba_params' is used to filter on time range + project_id
    - If the identifier is 'replay_id', the returned count is always 1. Use this to check the existence of replay_ids
    - Set the flag 'return_ids' to get the replay_ids (32 char hex strings) for each identifier
    """

    if snuba_params.start is None or snuba_params.end is None or snuba_params.organization is None:
        raise ValueError("Must provide start and end")

    if isinstance(data_source, Dataset):
        data_source = data_source.value

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
    query: str, snuba_params: SnubaParams, data_source: str = Dataset.Discover.value
) -> dict[str, list[str]]:
    """
    Parses select_column ("identifier") from a query, then queries data_source to map replay_id -> [identifier].
    If select_column is replay_id, return an identity map of replay_id -> [replay_id].
    The keys of the returned dict are UUIDs, represented as 32 char hex strings (all '-'s stripped)
    """
    if data_source == Dataset.Discover.value:
        search_query_func = discover.query
    elif data_source == Dataset.IssuePlatform.value:
        search_query_func = issue_platform.query  # type: ignore[assignment]
    else:
        raise ValueError("Invalid data source")

    select_column, column_value = _get_select_column(query)
    query = query + FILTER_HAS_A_REPLAY if data_source == Dataset.Discover else query

    if select_column == "replay_id":
        # just return a mapping of replay_id:replay_id instead of hitting discover.
        identity_map = {}
        for replay_id in column_value:
            # raises ValueError if invalid. Strips '-'
            replay_id = uuid.UUID(hex=replay_id, version=4).hex
            identity_map[replay_id] = [replay_id]
        return identity_map

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
            project__organization_id=snuba_params.organization.id,  # type: ignore[attr-defined]
            id__in=column_value,
        )
        snuba_params = dataclasses.replace(
            snuba_params,
            projects=[group.project for group in groups],
        )
        # Discover queries raise an error if projects is empty, so we skip Snuba in this case.
        if not snuba_params.projects:
            return {}

    results = search_query_func(
        snuba_params=snuba_params,
        selected_columns=["group_uniq_array(100,replay.id)", select_column],
        query=query,
        limit=25,
        offset=0,
        functions_acl=["group_uniq_array"],
        referrer="api.organization-issue-replay-count",
    )

    replay_id_to_issue_map = defaultdict(list)

    for row in results["data"]:
        for replay_id in row["group_uniq_array_100_replay_id"]:
            # When no replay exists these strings are provided in their empty
            # state rather than null. This can cause downstream problems so
            # we filter them out.
            if replay_id != "":
                replay_id_to_issue_map[replay_id].append(row[select_column])

    return replay_id_to_issue_map


def _get_counts(replay_results: Any, replay_ids_mapping: dict[str, list[str]]) -> dict[str, int]:
    """
    Get the number of existing replays associated with each identifier (ex identifier: issue_id)
    """
    ret: dict[str, int] = defaultdict(int)
    for row in replay_results["data"]:
        identifiers = replay_ids_mapping[
            row["rid"]
        ]  # use rid because replay_id results column might have dashes
        for identifier in identifiers:
            ret[identifier] = min(ret[identifier] + 1, MAX_REPLAY_COUNT)
    return ret


def _get_replay_ids(
    replay_results: Any, replay_ids_mapping: dict[str, list[str]]
) -> dict[str, list[str]]:
    """
    Get replay ids associated with each identifier (identifier -> [replay_id]) (ex identifier: issue_id)
    Can think of it as the inverse of _get_replay_id_mappings, excluding the replay_ids that don't exist
    """
    ret: dict[str, list[str]] = defaultdict(list)
    for row in replay_results["data"]:
        identifiers = replay_ids_mapping[row["rid"]]
        for identifier in identifiers:
            if len(ret[identifier]) < MAX_REPLAY_COUNT:
                ret[identifier].append(row["rid"])
    return ret


def _get_select_column(query: str) -> tuple[str, Sequence[Any]]:
    parsed_query = parse_search_query(query)

    select_column_conditions = list(extract_columns_recursive(parsed_query))
    if len(select_column_conditions) > 1:
        raise ValueError("Must provide only one of: issue.id, transaction, replay_id")
    elif len(select_column_conditions) == 0:
        raise ValueError("Must provide at least one issue.id, transaction, or replay_id")

    condition = select_column_conditions[0]

    if not isinstance(condition.value.raw_value, Sequence) or isinstance(
        condition.value.raw_value, str
    ):
        raise ValueError("Condition value must be a list of strings")

    if len(condition.value.raw_value) > MAX_VALS_PROVIDED[condition.key.name]:
        raise ValueError("Too many values provided")

    return condition.key.name, condition.value.raw_value


def extract_columns_recursive(query: list[Any]) -> Generator[SearchFilter]:
    for condition in query:
        if isinstance(condition, SearchFilter):
            if condition.key.name in ("issue.id", "transaction", "replay_id"):
                yield condition
        elif isinstance(condition, ParenExpression):
            yield from extract_columns_recursive(condition.children)
