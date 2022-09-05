from __future__ import annotations

from abc import ABC
from typing import List, Optional

from snuba_sdk.conditions import Condition, Op

from sentry.api.event_search import SearchFilter
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Environment, Release, SemverFilter
from sentry.search.events.constants import (
    MAX_SEARCH_RELEASES,
    OPERATOR_NEGATION_MAP,
    OPERATOR_TO_DJANGO,
    SEMVER_EMPTY_RELEASE,
)
from sentry.search.events.filter import _flip_field_sort, handle_operator_negation, parse_semver
from sentry.search.events.types import WhereType


class SemverAndStageFilterConverterMixin(ABC):
    builder = None

    def _release_stage_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        """
        Parses a release stage search and returns a snuba condition to filter to the
        requested releases.
        """
        # TODO: Filter by project here as well. It's done elsewhere, but could critically limit versions
        # for orgs with thousands of projects, each with their own releases (potentially drowning out ones we care about)

        if "organization_id" not in self.builder.params:
            raise ValueError("organization_id is a required param")

        organization_id: int = self.builder.params["organization_id"]
        project_ids: Optional[List[int]] = self.builder.params.get("project_id")
        environments: Optional[List[Environment]] = self.builder.params.get(
            "environment_objects", []
        )
        qs = (
            Release.objects.filter_by_stage(
                organization_id,
                search_filter.operator,
                search_filter.value.value,
                project_ids=project_ids,
                environments=environments,
            )
            .values_list("version", flat=True)
            .order_by("date_added")[:MAX_SEARCH_RELEASES]
        )
        versions = list(qs)

        if not versions:
            # XXX: Just return a filter that will return no results if we have no versions
            versions = [SEMVER_EMPTY_RELEASE]

        return Condition(self.builder.column("release"), Op.IN, versions)

    def _semver_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
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
        if "organization_id" not in self.builder.params:
            raise ValueError("organization_id is a required param")

        organization_id: int = self.builder.params["organization_id"]
        project_ids: Optional[List[int]] = self.builder.params.get("project_id")
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
                project_ids=project_ids,
            )
            .values_list("version", flat=True)
            .order_by(*order_by)[:MAX_SEARCH_RELEASES]
        )
        versions = list(qs)
        final_operator = Op.IN
        if len(versions) == MAX_SEARCH_RELEASES:
            # We want to limit how many versions we pass through to Snuba. If we've hit
            # the limit, make an extra query and see whether the inverse has fewer ids.
            # If so, we can do a NOT IN query with these ids instead. Otherwise, we just
            # do our best.
            operator = OPERATOR_NEGATION_MAP[operator]
            # Note that the `order_by` here is important for index usage. Postgres seems
            # to seq scan with this query if the `order_by` isn't included, so we
            # include it even though we don't really care about order for this query
            qs_flipped = (
                Release.objects.filter_by_semver(organization_id, parse_semver(version, operator))
                .order_by(*map(_flip_field_sort, order_by))
                .values_list("version", flat=True)[:MAX_SEARCH_RELEASES]
            )

            exclude_versions = list(qs_flipped)
            if exclude_versions and len(exclude_versions) < len(versions):
                # Do a negative search instead
                final_operator = Op.NOT_IN
                versions = exclude_versions

        if not versions:
            # XXX: Just return a filter that will return no results if we have no versions
            versions = [SEMVER_EMPTY_RELEASE]

        return Condition(self.builder.column("release"), final_operator, versions)

    def _semver_package_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        """
        Applies a semver package filter to the search. Note that if the query returns more than
        `MAX_SEARCH_RELEASES` here we arbitrarily return a subset of the releases.
        """
        if "organization_id" not in self.builder.params:
            raise ValueError("organization_id is a required param")

        organization_id: int = self.builder.params["organization_id"]
        project_ids: Optional[List[int]] = self.builder.params.get("project_id")
        package: str = search_filter.value.raw_value

        versions = list(
            Release.objects.filter_by_semver(
                organization_id,
                SemverFilter("exact", [], package),
                project_ids=project_ids,
            ).values_list("version", flat=True)[:MAX_SEARCH_RELEASES]
        )

        if not versions:
            # XXX: Just return a filter that will return no results if we have no versions
            versions = [SEMVER_EMPTY_RELEASE]

        return Condition(self.builder.column("release"), Op.IN, versions)

    def _semver_build_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        """
        Applies a semver build filter to the search. Note that if the query returns more than
        `MAX_SEARCH_RELEASES` here we arbitrarily return a subset of the releases.
        """
        if "organization_id" not in self.builder.params:
            raise ValueError("organization_id is a required param")

        organization_id: int = self.builder.params["organization_id"]
        project_ids: Optional[List[int]] = self.builder.params.get("project_id")
        build: str = search_filter.value.raw_value

        operator, negated = handle_operator_negation(search_filter.operator)
        try:
            django_op = OPERATOR_TO_DJANGO[operator]
        except KeyError:
            raise InvalidSearchQuery("Invalid operation 'IN' for semantic version filter.")
        versions = list(
            Release.objects.filter_by_semver_build(
                organization_id,
                django_op,
                build,
                project_ids=project_ids,
                negated=negated,
            ).values_list("version", flat=True)[:MAX_SEARCH_RELEASES]
        )

        if not versions:
            # XXX: Just return a filter that will return no results if we have no versions
            versions = [SEMVER_EMPTY_RELEASE]

        return Condition(self.builder.column("release"), Op.IN, versions)
