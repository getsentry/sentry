from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.exceptions import InvalidSearchQuery
from sentry.models.group import Group
from sentry.search.events.datasets.discover import InvalidIssueSearchQuery
from sentry.search.events.filter import to_list
from sentry.search.events.types import SnubaParams


def issue_filter_converter(params: SnubaParams, search_filter: SearchFilter) -> list[SearchFilter]:
    """
    Map ``issue`` search filters onto ``group_id``.

    Qualified short ids (scalar or IN list) resolve via the DB. Empty values are only
    accepted for ``has:issue`` (parser: ``issue`` with operator ``!=`` and empty value),
    which becomes ``group_id != ""``. Occurrences UI does not expose ``!has:``, so ``=``
    with an empty value is rejected.
    """
    if params.organization_id is None:
        raise InvalidSearchQuery("filter: issue required organization id")

    group_id_key = SearchKey("group_id")
    raw_values = to_list(search_filter.value.value)
    short_ids = [v for v in raw_values if v]

    if not short_ids:
        return _convert_issue_has_filter(search_filter, group_id_key)
    elif len(short_ids) > 1:
        raise InvalidSearchQuery("issue filter with more than one issue IDs not supported")
    try:
        groups = Group.objects.by_qualified_short_id_bulk(
            organization_id=params.organization_id,
            short_ids_raw=short_ids,
        )
    except Group.DoesNotExist:
        raise InvalidIssueSearchQuery(short_ids)
    except Exception:
        raise InvalidSearchQuery(f"Invalid value '{short_ids}' for 'issue:' filter")

    resolved_ids = sorted(g.id for g in groups)
    if search_filter.is_in_filter:
        mapped_value: int | list[int] = list(resolved_ids)
    else:
        mapped_value = resolved_ids[0]

    return [
        SearchFilter(
            key=group_id_key,
            operator=search_filter.operator,
            value=SearchValue(mapped_value),
        )
    ]


def _convert_issue_has_filter(
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
