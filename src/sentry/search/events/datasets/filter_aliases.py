from functools import reduce
from typing import List, Mapping, Optional

from snuba_sdk import Condition, Op

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events import constants
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.filter import to_list
from sentry.search.events.types import WhereType
from sentry.search.utils import parse_release
from sentry.utils.strings import oxfordize_list


def team_key_transaction_filter(builder: QueryBuilder, search_filter: SearchFilter) -> WhereType:
    value = search_filter.value.value
    key_transaction_expr = builder.resolve_field_alias(constants.TEAM_KEY_TRANSACTION_ALIAS)

    if search_filter.value.raw_value == "":
        return Condition(
            key_transaction_expr, Op.NEQ if search_filter.operator == "!=" else Op.EQ, 0
        )
    if value in ("1", 1):
        return Condition(key_transaction_expr, Op.EQ, 1)
    if value in ("0", 0):
        return Condition(key_transaction_expr, Op.EQ, 0)

    raise InvalidSearchQuery(
        "Invalid value for key_transaction condition. Accepted values are 1, 0"
    )


def release_filter_converter(builder: QueryBuilder, search_filter: SearchFilter) -> WhereType:
    """Parse releases for potential aliases like `latest`"""
    if search_filter.value.is_wildcard():
        operator = search_filter.operator
        value = search_filter.value
    else:
        operator_conversions = {"=": "IN", "!=": "NOT IN"}
        operator = operator_conversions.get(search_filter.operator, search_filter.operator)
        value = SearchValue(
            reduce(
                lambda x, y: x + y,
                [
                    parse_release(
                        v,
                        builder.params["project_id"],
                        builder.params.get("environment_objects"),
                        builder.params.get("organization_id"),
                    )
                    for v in to_list(search_filter.value.value)
                ],
                [],
            )
        )

    return builder._default_filter_converter(SearchFilter(search_filter.key, operator, value))


def project_slug_converter(
    builder: QueryBuilder, search_filter: SearchFilter
) -> Optional[WhereType]:
    """Convert project slugs to ids and create a filter based on those.
    This is cause we only store project ids in clickhouse.
    """
    value = search_filter.value.value

    if Op(search_filter.operator) == Op.EQ and value == "":
        raise InvalidSearchQuery(
            'Cannot query for has:project or project:"" as every event will have a project'
        )

    slugs = to_list(value)
    project_slugs: Mapping[str, int] = {
        slug: project_id for slug, project_id in builder.project_slugs.items() if slug in slugs
    }
    missing: List[str] = [slug for slug in slugs if slug not in project_slugs]
    if missing and search_filter.operator in constants.EQUALITY_OPERATORS:
        raise InvalidSearchQuery(
            f"Invalid query. Project(s) {oxfordize_list(missing)} do not exist or are not actively selected."
        )
    # Sorted for consistent query results
    project_ids = list(sorted(project_slugs.values()))
    if project_ids:
        # Create a new search filter with the correct values
        converted_filter = builder.convert_search_filter_to_condition(
            SearchFilter(
                SearchKey("project.id"),
                search_filter.operator,
                SearchValue(project_ids if search_filter.is_in_filter else project_ids[0]),
            )
        )
        if converted_filter:
            if search_filter.operator in constants.EQUALITY_OPERATORS:
                builder.projects_to_filter.update(project_ids)
            return converted_filter

    return None
