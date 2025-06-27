from typing import Literal

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.exceptions import InvalidSearchQuery
from sentry.models.release import Release
from sentry.models.releases.util import SemverFilter
from sentry.search.events import constants
from sentry.search.events.filter import (
    _flip_field_sort,
    handle_operator_negation,
    parse_semver,
    to_list,
)
from sentry.search.events.types import SnubaParams
from sentry.search.utils import parse_release, validate_snuba_array_parameter


def release_filter_converter(
    params: SnubaParams, search_filter: SearchFilter
) -> list[SearchFilter]:
    if search_filter.value.is_wildcard():
        operator = search_filter.operator
        value = search_filter.value
    else:
        operator_conversions = {"=": "IN", "!=": "NOT IN"}
        operator = operator_conversions.get(search_filter.operator, search_filter.operator)

        if params.environments:
            environments = [env for env in params.environments if env is not None]
        else:
            environments = []

        value = SearchValue(
            [
                part
                for v in to_list(search_filter.value.value)
                for part in parse_release(
                    v,
                    params.project_ids,
                    environments,
                    params.organization.id if params.organization else None,
                )
            ]
        )
    return [SearchFilter(search_filter.key, operator, value)]


def release_stage_filter_converter(
    params: SnubaParams, search_filter: SearchFilter
) -> list[SearchFilter]:
    organization_id = params.organization_id
    if organization_id is None:
        raise ValueError("organization is a required param")

    # TODO: Filter by project here as well. It's done elsewhere, but could critically limit versions
    # for orgs with thousands of projects, each with their own releases (potentially drowning out ones we care about)
    qs = (
        Release.objects.filter_by_stage(
            organization_id,
            search_filter.operator,
            search_filter.value.value,
            project_ids=params.project_ids,
            environments=params.environment_names,
        )
        .values_list("version", flat=True)
        .order_by("date_added")[: constants.MAX_SEARCH_RELEASES]
    )
    versions = list(qs)

    if not versions:
        # XXX: Just return a filter that will return no results if we have no versions
        versions = [constants.SEMVER_EMPTY_RELEASE]

    if not validate_snuba_array_parameter(versions):
        raise InvalidSearchQuery(
            "There are too many releases that match your release.stage filter, please try again with a narrower range"
        )

    return [SearchFilter(SearchKey(constants.RELEASE_ALIAS), "IN", SearchValue(versions))]


def semver_filter_converter(params: SnubaParams, search_filter: SearchFilter) -> list[SearchFilter]:
    organization_id = params.organization_id
    if organization_id is None:
        raise ValueError("organization is a required param")
    # We explicitly use `raw_value` here to avoid converting wildcards to shell values
    if not isinstance(search_filter.value.raw_value, str):
        raise InvalidSearchQuery(
            f"{search_filter.key.name}: Invalid value: {search_filter.value.raw_value}. Expected a semver version."
        )
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
            project_ids=params.project_ids,
        )
        .values_list("version", flat=True)
        .order_by(*order_by)[: constants.MAX_SEARCH_RELEASES]
    )
    versions = list(qs)
    final_operator: Literal["IN", "NOT IN"] = "IN"
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
            final_operator = "NOT IN"
            versions = exclude_versions

    if not validate_snuba_array_parameter(versions):
        raise InvalidSearchQuery(
            "There are too many releases that match your release.version filter, please try again with a narrower range"
        )

    if not versions:
        # XXX: Just return a filter that will return no results if we have no versions
        versions = [constants.SEMVER_EMPTY_RELEASE]

    return [SearchFilter(SearchKey(constants.RELEASE_ALIAS), final_operator, SearchValue(versions))]


def semver_package_filter_converter(
    params: SnubaParams, search_filter: SearchFilter
) -> list[SearchFilter]:
    organization_id = params.organization_id
    if organization_id is None:
        raise ValueError("organization is a required param")

    if not isinstance(search_filter.value.raw_value, str):
        raise InvalidSearchQuery(
            f"{search_filter.key.name}: Invalid value: {search_filter.value.raw_value}. Expected a semver package."
        )
    package: str = search_filter.value.raw_value

    versions = list(
        Release.objects.filter_by_semver(
            organization_id,
            SemverFilter("exact", [], package),
            project_ids=params.project_ids,
        ).values_list("version", flat=True)[: constants.MAX_SEARCH_RELEASES]
    )

    if not versions:
        # XXX: Just return a filter that will return no results if we have no versions
        versions = [constants.SEMVER_EMPTY_RELEASE]

    if not validate_snuba_array_parameter(versions):
        raise InvalidSearchQuery(
            "There are too many releases that match your release.package filter, please try again with a narrower range"
        )

    return [SearchFilter(SearchKey(constants.RELEASE_ALIAS), "IN", SearchValue(versions))]


def semver_build_filter_converter(
    params: SnubaParams, search_filter: SearchFilter
) -> list[SearchFilter]:
    organization_id = params.organization_id
    if organization_id is None:
        raise ValueError("organization is a required param")

    if not isinstance(search_filter.value.raw_value, str):
        raise InvalidSearchQuery(
            f"{search_filter.key.name}: Invalid value: {search_filter.value.raw_value}. Expected a semver build."
        )
    build: str = search_filter.value.raw_value

    operator, negated = handle_operator_negation(search_filter.operator)
    try:
        django_op = constants.OPERATOR_TO_DJANGO[operator]
    except KeyError:
        raise InvalidSearchQuery("Invalid operation 'IN' for semantic version filter.")
    versions = list(
        Release.objects.filter_by_semver_build(
            organization_id,
            django_op,
            build,
            project_ids=params.project_ids,
            negated=negated,
        ).values_list("version", flat=True)[: constants.MAX_SEARCH_RELEASES]
    )

    if not validate_snuba_array_parameter(versions):
        raise InvalidSearchQuery(
            "There are too many releases that match your release.build filter, please try again with a narrower range"
        )

    if not versions:
        # XXX: Just return a filter that will return no results if we have no versions
        versions = [constants.SEMVER_EMPTY_RELEASE]

    return [SearchFilter(SearchKey(constants.RELEASE_ALIAS), "IN", SearchValue(versions))]


def trace_filter_converter(params: SnubaParams, search_filter: SearchFilter) -> list[SearchFilter]:
    operator = search_filter.operator
    value = search_filter.value.value

    # special handling for 16 char trace id
    if operator == "=" and isinstance(value, str) and len(value) == 8:
        return [
            SearchFilter(SearchKey(constants.TRACE), ">=", SearchValue(value + "0" * 24)),
            SearchFilter(SearchKey(constants.TRACE), "<=", SearchValue(value + "f" * 24)),
        ]

    return [search_filter]


SPAN_FILTER_ALIAS_DEFINITIONS = {
    constants.RELEASE_ALIAS: release_filter_converter,
    constants.RELEASE_STAGE_ALIAS: release_stage_filter_converter,
    constants.SEMVER_ALIAS: semver_filter_converter,
    constants.SEMVER_PACKAGE_ALIAS: semver_package_filter_converter,
    constants.SEMVER_BUILD_ALIAS: semver_build_filter_converter,
    constants.TRACE: trace_filter_converter,
}
