from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.exceptions import InvalidSearchQuery
from sentry.models.group import Group
from sentry.search.events.types import SnubaParams


def issue_filter_converter(params: SnubaParams, search_filter: SearchFilter) -> list[SearchFilter]:
    if params.organization.id is None:
        raise InvalidSearchQuery("filter: issue required organization id")
    value = search_filter.value.value

    if value:
        try:
            group = Group.objects.by_qualified_short_id(
                organization_id=params.organization_id, short_id=value
            )
            value = group.id
        except Group.DoesNotExist:
            raise InvalidSearchQuery(f"Invalid value: '{value}' for issue filter")
    key = SearchKey("group_id")
    # Nit: assert for "has issue", operator should be "!=" and value should be "".
    return [SearchFilter(key=key, operator=search_filter.operator, value=SearchValue(value))]


OCCURRENCE_FILTER_ALIASES = {
    "issue": issue_filter_converter,
}
