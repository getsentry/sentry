from __future__ import annotations

from functools import partial
from typing import Callable, Iterable, List, Mapping, Optional, Sequence, Set, Union

from sentry import features
from sentry.api.event_search import (
    AggregateFilter,
    SearchConfig,
    SearchFilter,
    SearchKey,
    SearchValue,
    default_config,
)
from sentry.api.event_search import parse_search_query as base_parse_query
from sentry.exceptions import InvalidSearchQuery
from sentry.issues.grouptype import (
    GroupCategory,
    get_group_type_by_slug,
    get_group_types_by_category,
)
from sentry.models import Environment, Organization, Project, Team, User
from sentry.models.group import GROUP_SUBSTATUS_TO_STATUS_MAP, STATUS_QUERY_CHOICES, GroupStatus
from sentry.search.events.constants import EQUALITY_OPERATORS, INEQUALITY_OPERATORS
from sentry.search.events.filter import to_list
from sentry.search.utils import (
    DEVICE_CLASS,
    parse_actor_or_none_value,
    parse_release,
    parse_status_value,
    parse_substatus_value,
    parse_user_value,
)
from sentry.types.group import SUBSTATUS_UPDATE_CHOICES, GroupSubStatus

is_filter_translation = {
    "assigned": ("unassigned", False),
    "unassigned": ("unassigned", True),
    "for_review": ("for_review", True),
    "linked": ("linked", True),
    "unlinked": ("linked", False),
}
for status_key, status_value in STATUS_QUERY_CHOICES.items():
    is_filter_translation[status_key] = ("status", status_value)

for substatus_key, substatus_value in SUBSTATUS_UPDATE_CHOICES.items():
    is_filter_translation[substatus_key] = ("substatus", substatus_value)

issue_search_config = SearchConfig.create_from(
    default_config,
    allow_boolean=False,
    is_filter_translation=is_filter_translation,
    numeric_keys=default_config.numeric_keys | {"times_seen"},
    date_keys=default_config.date_keys | {"date", "first_seen", "last_seen"},
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

ValueConverter = Callable[
    [
        Iterable[Union[User, Team, str, GroupStatus, GroupSubStatus]],
        Sequence[Project],
        User,
        Optional[Sequence[Environment]],
    ],
    Union[str, List[str], List[Optional[Union[User, Team]]], List[User], List[int]],
]


def convert_actor_or_none_value(
    value: Iterable[Union[User, Team]],
    projects: Sequence[Project],
    user: User,
    environments: Optional[Sequence[Environment]],
) -> List[Optional[Union[User, Team]]]:
    # TODO: This will make N queries. This should be ok, we don't typically have large
    # lists of actors here, but we can look into batching it if needed.
    return [parse_actor_or_none_value(projects, actor, user) for actor in value]


def convert_user_value(
    value: Iterable[str],
    projects: Sequence[Project],
    user: User,
    environments: Optional[Sequence[Environment]],
) -> List[User]:
    # TODO: This will make N queries. This should be ok, we don't typically have large
    # lists of usernames here, but we can look into batching it if needed.
    return [parse_user_value(username, user) for username in value]


def convert_release_value(
    value: Iterable[str],
    projects: Sequence[Project],
    user: User,
    environments: Optional[Sequence[Environment]],
) -> Union[str, List[str]]:
    # TODO: This will make N queries. This should be ok, we don't typically have large
    # lists of versions here, but we can look into batching it if needed.
    releases: Set[str] = set()
    for version in value:
        releases.update(parse_release(version, projects, environments))
    results = list(releases)
    if len(results) == 1:
        return results[0]
    return results


def convert_first_release_value(
    value: Iterable[str],
    projects: Sequence[Project],
    user: User,
    environments: Optional[Sequence[Environment]],
) -> List[str]:
    # TODO: This will make N queries. This should be ok, we don't typically have large
    # lists of versions here, but we can look into batching it if needed.
    releases: Set[str] = set()
    for version in value:
        releases.update(parse_release(version, projects, environments))
    return list(releases)


def convert_substatus_value(
    value: Iterable[str | int],
    projects: Sequence[Project],
    user: User,
    environments: Sequence[Environment] | None,
) -> list[int]:
    parsed = []
    for substatus in value:
        try:
            parsed.append(parse_substatus_value(substatus))
        except ValueError:
            raise InvalidSearchQuery(f"invalid substatus value of '{substatus}'")
    return parsed


def convert_status_value(
    value: Iterable[Union[str, int]],
    projects: Sequence[Project],
    user: User,
    environments: Optional[Sequence[Environment]],
) -> List[int]:
    parsed = []
    for status in value:
        try:
            parsed.append(parse_status_value(status))
        except ValueError:
            raise InvalidSearchQuery(f"invalid status value of '{status}'")
    return parsed


def convert_category_value(
    value: Iterable[str],
    projects: Sequence[Project],
    user: User,
    environments: Optional[Sequence[Environment]],
) -> List[int]:
    """Convert a value like 'error' or 'performance' to the GroupType value for issue lookup"""
    results: List[int] = []
    for category in value:
        group_category = getattr(GroupCategory, category.upper(), None)
        if not group_category:
            raise InvalidSearchQuery(f"Invalid category value of '{category}'")
        results.extend(get_group_types_by_category(group_category.value))
    return results


def convert_type_value(
    value: Iterable[str],
    projects: Sequence[Project],
    user: User,
    environments: Optional[Sequence[Environment]],
) -> List[int]:
    """Convert a value like 'error' or 'performance_n_plus_one_db_queries' to the GroupType value for issue lookup"""
    results = []
    for type in value:
        group_type = get_group_type_by_slug(type)
        if not group_type:
            raise InvalidSearchQuery(f"Invalid type value of '{type}'")
        results.append(group_type.type_id)
    return results


def convert_device_class_value(
    value: Iterable[str],
    projects: Sequence[Project],
    user: User,
    environments: Optional[Sequence[Environment]],
) -> List[str]:
    """Convert high, medium, and low to the underlying device class values"""
    results = set()
    for device_class in value:
        device_class_values = DEVICE_CLASS.get(device_class)
        if not device_class_values:
            raise InvalidSearchQuery(f"Invalid type value of '{type}'")
        results.update(device_class_values)
    return list(results)


value_converters: Mapping[str, ValueConverter] = {
    "assigned_or_suggested": convert_actor_or_none_value,
    "assigned_to": convert_actor_or_none_value,
    "bookmarked_by": convert_user_value,
    "subscribed_by": convert_user_value,
    "first_release": convert_first_release_value,
    "release": convert_release_value,
    "status": convert_status_value,
    "regressed_in_release": convert_first_release_value,
    "issue.category": convert_category_value,
    "issue.type": convert_type_value,
    "device.class": convert_device_class_value,
    "substatus": convert_substatus_value,
}


def convert_query_values(
    search_filters: list[SearchFilter],
    projects: Sequence[Project],
    user: User,
    environments: Optional[Sequence[Environment]],
) -> List[SearchFilter]:
    """
    Accepts a collection of SearchFilter objects and converts their values into
    a specific format, based on converters specified in `value_converters`.
    :param search_filters: Collection of `SearchFilter` objects.
    :param projects: List of projects being searched across
    :param user: The user making the search
    :param environments: The environments to consider when making the search
    :return: New collection of `SearchFilters`, which may have converted values.
    """

    def convert_search_filter(
        search_filter: SearchFilter, organization: Organization
    ) -> SearchFilter:
        if search_filter.key.name == "empty_stacktrace.js_console":
            if not features.has(
                "organizations:javascript-console-error-tag", organization, actor=None
            ):
                raise InvalidSearchQuery(
                    "The empty_stacktrace.js_console filter is not supported for this organization"
                )

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

    def expand_substatus_query_values(
        search_filters: list[SearchFilter], org: Organization
    ) -> list[SearchFilter]:
        first_status_incl = None
        first_status_excl = None
        includes_status_filter = False
        includes_substatus_filter = False
        for search_filter in search_filters:
            if search_filter.key.name == "substatus":
                if not features.has("organizations:escalating-issues", org):
                    raise InvalidSearchQuery(
                        "The substatus filter is not supported for this organization"
                    )

                converted = convert_search_filter(search_filter, org)
                new_value = converted.value.raw_value
                status = GROUP_SUBSTATUS_TO_STATUS_MAP.get(
                    new_value[0] if isinstance(new_value, list) else new_value
                )
                if first_status_incl is None and converted.operator in EQUALITY_OPERATORS:
                    first_status_incl = SearchFilter(
                        key=SearchKey(name="status"), operator="IN", value=SearchValue([status])
                    )

                if first_status_excl is None and converted.operator in INEQUALITY_OPERATORS:
                    first_status_excl = SearchFilter(
                        key=SearchKey(name="status"), operator="NOT IN", value=SearchValue([status])
                    )

                includes_substatus_filter = True

            if search_filter.key.name == "status":
                includes_status_filter = True

        if includes_status_filter:
            return search_filters

        if includes_substatus_filter:
            assert first_status_incl is not None or first_status_excl is not None
            return search_filters + [first_status_incl or first_status_excl]

        return search_filters

    organization = projects[0].organization

    expanded_filters = expand_substatus_query_values(search_filters, organization)

    return [convert_search_filter(filter, organization) for filter in expanded_filters]
