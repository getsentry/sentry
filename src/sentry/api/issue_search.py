from functools import partial
from typing import List, Union

from sentry.api.event_search import AggregateFilter, SearchConfig, SearchValue, default_config
from sentry.api.event_search import parse_search_query as base_parse_query
from sentry.exceptions import InvalidSearchQuery
from sentry.models.group import STATUS_QUERY_CHOICES
from sentry.search.events.constants import EQUALITY_OPERATORS
from sentry.search.events.filter import to_list
from sentry.search.utils import (
    parse_actor_or_none_value,
    parse_release,
    parse_status_value,
    parse_user_value,
)
from sentry.utils.compat import map

is_filter_translation = {
    "assigned": ("unassigned", False),
    "unassigned": ("unassigned", True),
    "for_review": ("for_review", True),
    "linked": ("linked", True),
    "unlinked": ("linked", False),
}
for status_key, status_value in STATUS_QUERY_CHOICES.items():
    is_filter_translation[status_key] = ("status", status_value)


issue_search_config = SearchConfig.create_from(
    default_config,
    allow_boolean=False,
    is_filter_translation=is_filter_translation,
    numeric_keys=default_config.numeric_keys | {"times_seen"},
    date_keys=default_config.date_keys | {"date"},
    key_mappings={
        "assigned_to": ["assigned"],
        "bookmarked_by": ["bookmarks"],
        "subscribed_by": ["subscribed"],
        "assigned_or_suggested": ["assigned_or_suggested"],
        "first_release": ["first-release", "firstRelease"],
        "first_seen": ["age", "firstSeen"],
        "last_seen": ["lastSeen"],
        # TODO: Special case this in the backends, since they currently rely
        # on date_from and date_to explicitly
        "date": ["event.timestamp"],
        "times_seen": ["timesSeen"],
        "sentry:dist": ["dist"],
    },
)
parse_search_query = partial(base_parse_query, config=issue_search_config)


def convert_actor_or_none_value(value, projects, user, environments):
    # TODO: This will make N queries. This should be ok, we don't typically have large
    # lists of actors here, but we can look into batching it if needed.
    return [parse_actor_or_none_value(projects, actor, user) for actor in value]


def convert_user_value(value, projects, user, environments):
    # TODO: This will make N queries. This should be ok, we don't typically have large
    # lists of usernames here, but we can look into batching it if needed.
    return [parse_user_value(username, user) for username in value]


def convert_release_value(value, projects, user, environments) -> Union[str, List[str]]:
    # TODO: This will make N queries. This should be ok, we don't typically have large
    # lists of versions here, but we can look into batching it if needed.
    releases = [parse_release(version, projects, environments) for version in value]
    if len(releases) == 1:
        return releases[0]
    return releases


def convert_first_release_value(value, projects, user, environments) -> List[str]:
    # TODO: This will make N queries. This should be ok, we don't typically have large
    # lists of versions here, but we can look into batching it if needed.
    return [parse_release(version, projects, environments) for version in value]


def convert_status_value(value, projects, user, environments):
    parsed = []
    for status in value:
        try:
            parsed.append(parse_status_value(status))
        except ValueError:
            raise InvalidSearchQuery(f"invalid status value of '{status}'")
    return parsed


value_converters = {
    "assigned_or_suggested": convert_actor_or_none_value,
    "assigned_to": convert_actor_or_none_value,
    "bookmarked_by": convert_user_value,
    "subscribed_by": convert_user_value,
    "first_release": convert_first_release_value,
    "release": convert_release_value,
    "status": convert_status_value,
}


def convert_query_values(search_filters, projects, user, environments):
    """
    Accepts a collection of SearchFilter objects and converts their values into
    a specific format, based on converters specified in `value_converters`.
    :param search_filters: Collection of `SearchFilter` objects.
    :param projects: List of projects being searched across
    :param user: The user making the search
    :return: New collection of `SearchFilters`, which may have converted values.
    """

    def convert_search_filter(search_filter):
        if search_filter.key.name in value_converters:
            converter = value_converters[search_filter.key.name]
            new_value = converter(
                to_list(search_filter.value.raw_value), projects, user, environments
            )
            if isinstance(new_value, list):
                operator = "IN" if search_filter.operator in EQUALITY_OPERATORS else "NOT IN"
            else:
                operator = "=" if search_filter.operator in EQUALITY_OPERATORS else "!="
            search_filter = search_filter._replace(
                value=SearchValue(new_value),
                operator=operator,
            )
        elif isinstance(search_filter, AggregateFilter):
            raise InvalidSearchQuery(
                f"Aggregate filters ({search_filter.key.name}) are not supported in issue searches."
            )
        return search_filter

    return map(convert_search_filter, search_filters)
