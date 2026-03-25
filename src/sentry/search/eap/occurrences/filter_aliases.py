from typing import Any

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.filter import to_list
from sentry.search.events.types import SnubaParams


def issue_filter_converter(
    params: SnubaParams, search_filter: SearchFilter, resolver: Any
) -> list[SearchFilter]:
    """
    Map ``issue`` search filters onto ``group_id``.
    """
    if params.organization_id is None:
        raise InvalidSearchQuery("filter: issue required organization id")

    group_id_key = SearchKey("group_id")
    raw_values = to_list(search_filter.value.value)
    short_ids = [v for v in raw_values if v]

    if not short_ids:
        return _convert_has_issue_filter(search_filter, group_id_key)

    resolved_ids = _get_group_ids(params, short_ids, resolver)
    if search_filter.is_in_filter:
        mapped_value = resolved_ids
    else:
        mapped_value = resolved_ids[0]

    return [
        SearchFilter(
            key=group_id_key,
            operator=search_filter.operator,
            value=SearchValue(mapped_value),
        )
    ]


def _get_group_ids(params: SnubaParams, issue_identifiers: list[str], resolver: Any) -> list[int]:
    cache: dict = resolver.qualified_short_id_to_group_id_cache
    group_id_issue_map = {}
    for project_id in params.project_ids:
        # All project_ids will exist.
        group_id_issue_map.update(cache.get(project_id, {}))

    return sorted(group_id_issue_map[issue_id] for issue_id in issue_identifiers)


def _convert_has_issue_filter(
    search_filter: SearchFilter, group_id_key: SearchKey
) -> list[SearchFilter]:
    """Empty parsed value: only ``has:issue`` (``!=``) is supported for occurrences."""
    if search_filter.operator != "!=":
        raise InvalidSearchQuery("issue filter with no short id only supports operator !=")
    return [
        SearchFilter(
            key=group_id_key,
            operator=search_filter.operator,
            value=SearchValue(search_filter.value.value),
        )
    ]


OCCURRENCE_FILTER_ALIASES = {
    "issue": issue_filter_converter,
}
