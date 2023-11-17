from __future__ import annotations

from functools import reduce
from typing import List, Mapping, Optional

from snuba_sdk import Column, Condition, Op

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.exceptions import InvalidSearchQuery
from sentry.models.release import Release, SemverFilter
from sentry.search.events import builder, constants
from sentry.search.events.filter import (
    _flip_field_sort,
    handle_operator_negation,
    parse_semver,
    to_list,
)
from sentry.search.events.types import WhereType
from sentry.search.utils import DEVICE_CLASS, parse_release
from sentry.utils.strings import oxfordize_list


def team_key_transaction_filter(
    builder: builder.QueryBuilder, search_filter: SearchFilter
) -> WhereType:
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


def release_filter_converter(
    builder: builder.QueryBuilder, search_filter: SearchFilter
) -> Optional[WhereType]:
    """Parse releases for potential aliases like `latest`"""
    if search_filter.value.is_wildcard():
        operator = search_filter.operator
        value = search_filter.value
    else:
        operator_conversions = {"=": "IN", "!=": "NOT IN"}
        operator = operator_conversions.get(search_filter.operator, search_filter.operator)
        value = SearchValue(
            reduce(
                lambda x, y: x + y,  # type: ignore
                [
                    parse_release(
                        v,
                        builder.params.project_ids,
                        builder.params.environments,
                        builder.params.organization.id if builder.params.organization else None,
                    )
                    for v in to_list(search_filter.value.value)
                ],
                [],
            )
        )

    return builder.default_filter_converter(SearchFilter(search_filter.key, operator, value))


def project_slug_converter(
    builder: builder.QueryBuilder, search_filter: SearchFilter
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
        slug: project_id
        for slug, project_id in builder.params.project_slug_map.items()
        if slug in slugs
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


def span_is_segment_converter(search_filter: SearchFilter) -> Optional[WhereType]:
    """Convert the search filter from a string to a boolean
    and unalias the filter key.
    """
    if search_filter.value.raw_value not in ["0", "1"]:
        raise ValueError("is_segment must be 0 or 1")

    return Condition(
        Column("is_segment"),
        Op.NEQ if search_filter.operator == "!=" else Op.EQ,
        int(search_filter.value.raw_value),
    )


def release_stage_filter_converter(
    builder: builder.QueryBuilder, search_filter: SearchFilter
) -> Optional[WhereType]:
    """
    Parses a release stage search and returns a snuba condition to filter to the
    requested releases.
    """
    if builder.params.organization is None:
        raise ValueError("organization is a required param")
    # TODO: Filter by project here as well. It's done elsewhere, but could critically limit versions
    # for orgs with thousands of projects, each with their own releases (potentially drowning out ones we care about)
    qs = (
        Release.objects.filter_by_stage(
            builder.params.organization.id,
            search_filter.operator,
            search_filter.value.value,
            project_ids=builder.params.project_ids,
            environments=builder.params.environments,
        )
        .values_list("version", flat=True)
        .order_by("date_added")[: constants.MAX_SEARCH_RELEASES]
    )
    versions = list(qs)

    if not versions:
        # XXX: Just return a filter that will return no results if we have no versions
        versions = [constants.SEMVER_EMPTY_RELEASE]

    return Condition(builder.column("release"), Op.IN, versions)


def semver_filter_converter(
    builder: builder.QueryBuilder, search_filter: SearchFilter
) -> Optional[WhereType]:
    """
    Parses a semver query search and returns a snuba condition to filter to the
    requested releases.

    Since we only have semver information available in Postgres currently, we query
    Postgres and return a list of versions to include/exclude. For most customers this
    will work well, however some have extremely large numbers of releases, and we can't
    pass them all to Snuba. To try and serve reasonable results, we:
     - Attempt to query based on the initial semver query. If this returns
       MAX_SEMVER_SEARCH_RELEASES results, we invert the query and see if it returns
       fewer results. If so, we use a `NOT IN` snuba condition instead of an `IN`.
     - Order the results such that the versions we return are semantically closest to
       the passed filter. This means that when searching for `>= 1.0.0`, we'll return
       version 1.0.0, 1.0.1, 1.1.0 before 9.x.x.
    """
    if builder.params.organization is None:
        raise ValueError("organization is a required param")
    organization_id: int = builder.params.organization.id
    # We explicitly use `raw_value` here to avoid converting wildcards to shell values
    version: str = search_filter.value.raw_value
    operator: str = search_filter.operator

    # Note that we sort this such that if we end up fetching more than
    # MAX_SEMVER_SEARCH_RELEASES, we will return the releases that are closest to
    # the passed filter.
    order_by = Release.SEMVER_COLS
    if operator.startswith("<"):
        order_by = list(map(_flip_field_sort, order_by))
    qs = (
        Release.objects.filter_by_semver(
            organization_id,
            parse_semver(version, operator),
            project_ids=builder.params.project_ids,
        )
        .values_list("version", flat=True)
        .order_by(*order_by)[: constants.MAX_SEARCH_RELEASES]
    )
    versions = list(qs)
    final_operator = Op.IN
    if len(versions) == constants.MAX_SEARCH_RELEASES:
        # We want to limit how many versions we pass through to Snuba. If we've hit
        # the limit, make an extra query and see whether the inverse has fewer ids.
        # If so, we can do a NOT IN query with these ids instead. Otherwise, we just
        # do our best.
        operator = constants.OPERATOR_NEGATION_MAP[operator]
        # Note that the `order_by` here is important for index usage. Postgres seems
        # to seq scan with this query if the `order_by` isn't included, so we
        # include it even though we don't really care about order for this query
        qs_flipped = (
            Release.objects.filter_by_semver(organization_id, parse_semver(version, operator))
            .order_by(*map(_flip_field_sort, order_by))
            .values_list("version", flat=True)[: constants.MAX_SEARCH_RELEASES]
        )

        exclude_versions = list(qs_flipped)
        if exclude_versions and len(exclude_versions) < len(versions):
            # Do a negative search instead
            final_operator = Op.NOT_IN
            versions = exclude_versions

    if not versions:
        # XXX: Just return a filter that will return no results if we have no versions
        versions = [constants.SEMVER_EMPTY_RELEASE]

    return Condition(builder.column("release"), final_operator, versions)


def semver_package_filter_converter(
    builder: builder.QueryBuilder, search_filter: SearchFilter
) -> Optional[WhereType]:
    """
    Applies a semver package filter to the search. Note that if the query returns more than
    `MAX_SEARCH_RELEASES` here we arbitrarily return a subset of the releases.
    """
    if builder.params.organization is None:
        raise ValueError("organization is a required param")
    package: str = search_filter.value.raw_value

    versions = list(
        Release.objects.filter_by_semver(
            builder.params.organization.id,
            SemverFilter("exact", [], package),
            project_ids=builder.params.project_ids,
        ).values_list("version", flat=True)[: constants.MAX_SEARCH_RELEASES]
    )

    if not versions:
        # XXX: Just return a filter that will return no results if we have no versions
        versions = [constants.SEMVER_EMPTY_RELEASE]

    return Condition(builder.column("release"), Op.IN, versions)


def semver_build_filter_converter(
    builder: builder.QueryBuilder, search_filter: SearchFilter
) -> Optional[WhereType]:
    """
    Applies a semver build filter to the search. Note that if the query returns more than
    `MAX_SEARCH_RELEASES` here we arbitrarily return a subset of the releases.
    """
    if builder.params.organization is None:
        raise ValueError("organization is a required param")
    build: str = search_filter.value.raw_value

    operator, negated = handle_operator_negation(search_filter.operator)
    try:
        django_op = constants.OPERATOR_TO_DJANGO[operator]
    except KeyError:
        raise InvalidSearchQuery("Invalid operation 'IN' for semantic version filter.")
    versions = list(
        Release.objects.filter_by_semver_build(
            builder.params.organization.id,
            django_op,
            build,
            project_ids=builder.params.project_ids,
            negated=negated,
        ).values_list("version", flat=True)[: constants.MAX_SEARCH_RELEASES]
    )

    if not versions:
        # XXX: Just return a filter that will return no results if we have no versions
        versions = [constants.SEMVER_EMPTY_RELEASE]

    return Condition(builder.column("release"), Op.IN, versions)


def device_class_converter(
    builder: builder.QueryBuilder, search_filter: SearchFilter
) -> Optional[WhereType]:
    value = search_filter.value.value
    if value not in DEVICE_CLASS:
        raise InvalidSearchQuery(f"{value} is not a supported device.class")
    return Condition(builder.column("device.class"), Op.IN, list(DEVICE_CLASS[value]))
