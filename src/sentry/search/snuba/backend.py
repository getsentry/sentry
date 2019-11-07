from __future__ import absolute_import

import functools
import logging
from datetime import timedelta
from hashlib import md5

from django.db.models import Q
from django.utils import timezone

# from sentry import options, quotas
from sentry import quotas
from sentry.api.event_search import convert_search_filter_to_snuba_query

# from sentry.api.paginator import DateTimePaginator, SequencePaginator, Paginator
# from sentry.constants import ALLOWED_FUTURE_DELTA
# from sentry.models import Group, Release, GroupEnvironment
from sentry.search.base import (
    assigned_to_filter,
    unassigned_filter,
    dependency_aggregations,
    issue_only_fields,
    # paginator_results_estimator,
    QCallbackCondition,
    QuerySetBuilder,
    ScalarCondition,
    SearchBackend,
)
from sentry.utils import snuba, metrics


class SnubaSearchBackend(SearchBackend):
    logger = logging.getLogger("sentry.search.snuba")
    issue_only_fields = set(
        [
            "query",
            "status",
            "bookmarked_by",
            "assigned_to",
            "unassigned",
            "subscribed_by",
            "active_at",
            "first_release",
            "first_seen",
        ]
    )
    # mapping from query parameter sort name to underlying scoring aggregation name
    sort_strategies = {
        "date": "last_seen",
        "freq": "times_seen",
        "new": "first_seen",
        "priority": "priority",
    }

    aggregation_defs = {
        "times_seen": ["count()", ""],
        "first_seen": ["multiply(toUInt64(min(timestamp)), 1000)", ""],
        "last_seen": ["multiply(toUInt64(max(timestamp)), 1000)", ""],
        # https://github.com/getsentry/sentry/blob/804c85100d0003cfdda91701911f21ed5f66f67c/src/sentry/event_manager.py#L241-L271
        "priority": ["toUInt64(plus(multiply(log(times_seen), 600), last_seen))", ""],
        # Only makes sense with WITH TOTALS, returns 1 for an individual group.
        "total": ["uniq", "issue"],
    }

    def query(
        self,
        projects,
        environments=None,
        sort_by="date",
        limit=100,
        cursor=None,
        count_hits=False,
        paginator_options=None,
        search_filters=None,
        date_from=None,
        date_to=None,
    ):
        from sentry.models import Group, GroupStatus, GroupSubscription

        search_filters = search_filters if search_filters is not None else []

        # ensure projects are from same org
        if len({p.organization_id for p in projects}) != 1:
            raise RuntimeError("Cross organization search not supported")

        if paginator_options is None:
            paginator_options = {}

        group_queryset = Group.objects.filter(project__in=projects).exclude(
            status__in=[
                GroupStatus.PENDING_DELETION,
                GroupStatus.DELETION_IN_PROGRESS,
                GroupStatus.PENDING_MERGE,
            ]
        )

        qs_builder_conditions = {
            "status": QCallbackCondition(lambda status: Q(status=status)),
            "bookmarked_by": QCallbackCondition(
                lambda user: Q(bookmark_set__project__in=projects, bookmark_set__user=user)
            ),
            "assigned_to": QCallbackCondition(
                functools.partial(assigned_to_filter, projects=projects)
            ),
            "unassigned": QCallbackCondition(
                functools.partial(unassigned_filter, projects=projects)
            ),
            "subscribed_by": QCallbackCondition(
                lambda user: Q(
                    id__in=GroupSubscription.objects.filter(
                        project__in=projects, user=user, is_active=True
                    ).values_list("group")
                )
            ),
            "active_at": ScalarCondition("active_at"),
        }

        group_queryset = QuerySetBuilder(qs_builder_conditions).build(
            group_queryset, search_filters
        )
        # filter out groups which are beyond the retention period
        retention = quotas.get_event_retention(organization=projects[0].organization)
        if retention:
            retention_window_start = timezone.now() - timedelta(days=retention)
        else:
            retention_window_start = None
        # TODO: This could be optimized when building querysets to identify
        # criteria that are logically impossible (e.g. if the upper bound
        # for last seen is before the retention window starts, no results
        # exist.)
        if retention_window_start:
            group_queryset = group_queryset.filter(last_seen__gte=retention_window_start)

        # This is a punt because the SnubaSearchBackend (a subclass) shares so much that it
        # seemed better to handle all the shared initialization and then handoff to the
        # actual backend.
        return self._query(
            projects,
            retention_window_start,
            group_queryset,
            environments,
            sort_by,
            limit,
            cursor,
            count_hits,
            paginator_options,
            search_filters,
            date_from,
            date_to,
        )

    def _query(
        self,
        projects,
        retention_window_start,
        group_queryset,
        environments,
        sort_by,
        limit,
        cursor,
        count_hits,
        paginator_options,
        search_filters,
        date_from,
        date_to,
    ):
        from sentry.models import Release, GroupEnvironment

        # TODO: It's possible `first_release` could be handled by Snuba.
        if environments is not None:
            environment_ids = [environment.id for environment in environments]
            group_queryset = group_queryset.filter(
                groupenvironment__environment_id__in=environment_ids
            )
            group_queryset = QuerySetBuilder(
                {
                    "first_release": QCallbackCondition(
                        lambda version: Q(
                            # if environment(s) are selected, we just filter on the group
                            # environment's first_release attribute.
                            groupenvironment__first_release__organization_id=projects[
                                0
                            ].organization_id,
                            groupenvironment__first_release__version=version,
                            groupenvironment__environment_id__in=environment_ids,
                        )
                    ),
                    "first_seen": ScalarCondition(
                        "groupenvironment__first_seen",
                        {"groupenvironment__environment_id__in": environment_ids},
                    ),
                }
            ).build(group_queryset, search_filters)
        else:
            group_queryset = QuerySetBuilder(
                {
                    "first_release": QCallbackCondition(
                        lambda release_version: Q(
                            # if no specific environments are supplied, we either choose any
                            # groups/issues whose first release matches the given release_version,
                            Q(
                                first_release_id__in=Release.objects.filter(
                                    version=release_version,
                                    organization_id=projects[0].organization_id,
                                )
                            )
                            |
                            # or we choose any groups whose first occurrence in any environment and the latest release at
                            # the time of the groups' first occurrence matches the given
                            # release_version
                            Q(
                                id__in=GroupEnvironment.objects.filter(
                                    first_release__version=release_version,
                                    first_release__organization_id=projects[0].organization_id,
                                    environment__organization_id=projects[0].organization_id,
                                ).values_list("group_id")
                            )
                        )
                    ),
                    "first_seen": ScalarCondition("first_seen"),
                }
            ).build(group_queryset, search_filters)

        return self.paginator_results_estimator(
            projects,
            retention_window_start,
            group_queryset,
            environments,
            sort_by,
            limit,
            cursor,
            count_hits,
            paginator_options,
            search_filters,
            date_from,
            date_to,
        )

    def snuba_search(
        self,
        start,
        end,
        project_ids,
        environment_ids,
        sort_field,
        cursor=None,
        candidate_ids=None,
        limit=None,
        offset=0,
        get_sample=False,
        search_filters=None,
    ):
        """
        This function doesn't strictly benefit from or require being pulled out of the main
        query method above, but the query method is already large and this function at least
        extracts most of the Snuba-specific logic.

        Returns a tuple of:
        * a sorted list of (group_id, group_score) tuples sorted descending by score,
        * the count of total results (rows) available for this query.
        """
        filters = {"project_id": project_ids}

        if environment_ids is not None:
            filters["environment"] = environment_ids

        if candidate_ids:
            filters["issue"] = sorted(candidate_ids)

        conditions = []
        having = []
        for search_filter in search_filters:
            if (
                # Don't filter on issue fields here, they're not available
                search_filter.key.name in issue_only_fields
                or
                # We special case date
                search_filter.key.name == "date"
            ):
                continue
            converted_filter = convert_search_filter_to_snuba_query(search_filter)

            # Ensure that no user-generated tags that clashes with aggregation_defs is added to having
            if search_filter.key.name in self.aggregation_defs and not search_filter.key.is_tag:
                having.append(converted_filter)
            else:
                conditions.append(converted_filter)

        extra_aggregations = dependency_aggregations.get(sort_field, [])
        required_aggregations = set([sort_field, "total"] + extra_aggregations)
        for h in having:
            alias = h[0]
            required_aggregations.add(alias)

        aggregations = []
        for alias in required_aggregations:
            aggregations.append(self.aggregation_defs[alias] + [alias])

        if cursor is not None:
            having.append((sort_field, ">=" if cursor.is_prev else "<=", cursor.value))

        selected_columns = []
        if get_sample:
            query_hash = md5(repr(conditions)).hexdigest()[:8]
            selected_columns.append(("cityHash64", ("'{}'".format(query_hash), "issue"), "sample"))
            sort_field = "sample"
            orderby = [sort_field]
            referrer = "search_sample"
        else:
            # Get the top matching groups by score, i.e. the actual search results
            # in the order that we want them.
            orderby = [
                "-{}".format(sort_field),
                "issue",
            ]  # ensure stable sort within the same score
            referrer = "search"

        snuba_results = snuba.dataset_query(
            dataset=snuba.Dataset.Events,
            start=start,
            end=end,
            selected_columns=selected_columns,
            groupby=["issue"],
            conditions=conditions,
            having=having,
            filter_keys=filters,
            aggregations=aggregations,
            orderby=orderby,
            referrer=referrer,
            limit=limit,
            offset=offset,
            totals=True,  # Needs to have totals_mode=after_having_exclusive so we get groups matching HAVING only
            turbo=get_sample,  # Turn off FINAL when in sampling mode
            sample=1,  # Don't use clickhouse sampling, even when in turbo mode.
        )
        rows = snuba_results["data"]
        total = snuba_results["totals"]["total"]

        if not get_sample:
            metrics.timing("snuba.search.num_result_groups", len(rows))

        return [(row["issue"], row[sort_field]) for row in rows], total
