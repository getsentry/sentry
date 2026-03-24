from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.exceptions import InvalidSearchQuery
from sentry.models.group import Group
from sentry.search.events.datasets.discover import InvalidIssueSearchQuery
from sentry.search.events.filter import to_list
from sentry.search.events.types import SnubaParams


def issue_filter_converter(params: SnubaParams, search_filter: SearchFilter) -> list[SearchFilter]:
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

    resolved_ids = _get_group_ids(params, short_ids)
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


def _get_group_ids(params: SnubaParams, issue_identifiers: list[str]) -> list[int]:
    cached_issue_ids = set(issue_identifiers).intersection(
        params.issue_qualified_short_id_to_group_id.keys()
    )
    cached_group_ids = []
    fetched_group_ids = []
    if cached_issue_ids:
        cached_group_ids = sorted(
            params.issue_qualified_short_id_to_group_id[issue_id] for issue_id in cached_issue_ids
        )
    remaining_issue_ids = set(issue_identifiers) - cached_issue_ids
    if remaining_issue_ids:
        remaining_issue_ids = list(remaining_issue_ids)
        try:
            groups = Group.objects.by_qualified_short_id_bulk(
                organization_id=params.organization_id,
                short_ids_raw=remaining_issue_ids,
            )
        except Group.DoesNotExist:
            raise InvalidIssueSearchQuery(remaining_issue_ids)
        except Exception:
            raise InvalidSearchQuery(f"Invalid value '{remaining_issue_ids}' for 'issue:' filter")

        fetched_group_ids = sorted(g.id for g in groups)
    return cached_group_ids + fetched_group_ids


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
