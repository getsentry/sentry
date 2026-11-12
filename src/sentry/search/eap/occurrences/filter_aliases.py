from typing import Any

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.filter import to_list
from sentry.search.events.types import SnubaParams


def issue_filter_converter(
    params: SnubaParams, search_filter: SearchFilter, resolver: Any
) -> list[SearchFilter]:
    """
    Map ``issue`` and ``issue.id`` search filters onto ``group_id``. Both accept numeric group
    IDs and qualified short IDs.
    """
    if params.organization_id is None:
        raise InvalidSearchQuery("filter: issue required organization id")

    group_id_key = SearchKey("group_id")
    identifiers = [v for v in to_list(search_filter.value.value) if v]

    if not identifiers:
        return _convert_has_issue_filter(search_filter, group_id_key)

    # Strings were resolved up front by the resolver; numbers come from the `issue.id` parser.
    cache: dict[str, int] = resolver.issue_id_to_group_id_cache
    resolved_ids = sorted(cache[v] if isinstance(v, str) else int(v) for v in identifiers)
    mapped_value: list[int] | int
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
    "issue.id": issue_filter_converter,
}
