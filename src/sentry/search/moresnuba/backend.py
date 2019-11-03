from __future__ import absolute_import

import datetime
import functools
import time
from datetime import timedelta
from hashlib import md5

from django.db.models import Q
from django.utils import timezone

from sentry import quotas
from sentry.api.event_search import convert_search_filter_to_snuba_query, TAG_KEY_RE
from sentry.utils import snuba, metrics
from sentry.search.snuba.base import (
    SnubaSearchBackendBase,
    QCallbackCondition,
    QuerySetBuilder,
    assigned_to_filter,
    unassigned_filter,
    logger,
    dependency_aggregations,
    paginator_results_estimator,
)

sort_strategies = {
    "date": "events.last_seen",
    "freq": "times_seen",
    "new": "events.first_seen",
    "priority": "priority",
}

aggregation_defs = {
    "times_seen": ["count()", ""],
    "events.first_seen": ["multiply(toUInt64(min(events.timestamp)), 1000)", ""],
    "events.last_seen": ["multiply(toUInt64(max(events.timestamp)), 1000)", ""],
    # https://github.com/getsentry/sentry/blob/804c85100d0003cfdda91701911f21ed5f66f67c/src/sentry/event_manager.py#L241-L271
    "priority": ["toUInt64(plus(multiply(log(times_seen), 600), events.last_seen))", ""],
    # Only makes sense with WITH TOTALS, returns 1 for an individual group.
    "events.total": ["uniq", "events.issue"],
}

issue_only_fields = set(["query", "bookmarked_by", "assigned_to", "unassigned", "subscribed_by"])


class MoreSnubaSearchBackend(SnubaSearchBackendBase):
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
        # print ("Running New Backend Query...")

        start_time = time.time()
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

        results = self._query(
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

        end_time = time.time()
        run_time = end_time - start_time
        # print ("MoreSnuba Runtime: (seconds):", run_time)
        # print ("MoreSnuba Results:", results.results)
        logger.debug("SEN-1050/MoreSnuba Results: %r", results.results)
        logger.debug("SEN-1050/MoreSnuba Runtime: (seconds): %r", run_time)

        return results

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

        return paginator_results_estimator(
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
        filters["events.issue"] = sorted(candidate_ids)

    conditions = []
    having = []
    extra_aggregations = dependency_aggregations.get(sort_field, [])

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

        special_date_names = ["groups.active_at", "first_seen", "last_seen"]
        if search_filter.key.name in special_date_names:
            # Need to get '2018-02-06T03:35:54' out of 1517888878000
            datetime_value = datetime.datetime.fromtimestamp(converted_filter[2] / 1000)
            datetime_value = datetime_value.replace(microsecond=0).isoformat().replace("+00:00", "")
            converted_filter[2] = datetime_value

        # Ensure that no user-generated tags that clashes with aggregation_defs is added to having
        if search_filter.key.name in aggregation_defs and not search_filter.key.is_tag:
            having.append(converted_filter)
        else:
            # Because we are using the groups dataset, tags (retrieved from the event table) must be prefixed with `events.`.
            # Other fields, such as first_seen, last_seen, and first_release will come from `groups` if there are no environment filters, and `events` if there are.
            # Another spot to do this could be the convert_search_filter_to_snuba_query function (event_search.py  ~line 595 where it is returned)
            # But that may have unintended consequences to it's other usages. So for now, I am doing it here as a "first draft"
            if isinstance(converted_filter[0], list) and TAG_KEY_RE.match(
                converted_filter[0][1][0]
            ):
                converted_filter[0][1][0] = "events." + converted_filter[0][1][0]
            elif search_filter.key.name in ["first_seen", "last_seen", "first_release"]:
                if environment_ids is not None:
                    table_alias = "events"
                else:
                    table_alias = "groups"

                if isinstance(converted_filter[0], list):
                    converted_filter[0][1][0] = table_alias + "." + converted_filter[0][1][0]
                else:
                    converted_filter[0] = table_alias + "." + converted_filter[0]
                    # We can't query on the aggregate functions in WHERE, so we actually want to query on the timestamp.
                    if (
                        converted_filter[0] == "events.first_seen"
                        or converted_filter[0] == "events.last_seen"
                    ):
                        converted_filter[0] = "events.timestamp"

                # # Need to add the aggregations (say for events.first_seen and events.last_seen?) so snuba knows what they are.
                # if aggregation_defs.get(converted_filter[0], None) is not None:
                #     extra_aggregations.append(converted_filter[0])

            conditions.append(converted_filter)

    required_aggregations = set([sort_field, "events.total"] + extra_aggregations)
    for h in having:
        alias = h[0]
        required_aggregations.add(alias)

    aggregations = []
    for alias in required_aggregations:
        aggregations.append(aggregation_defs[alias] + [alias])

    if cursor is not None:
        having.append((sort_field, ">=" if cursor.is_prev else "<=", cursor.value))
    selected_columns = []
    if get_sample:
        query_hash = md5(repr(conditions)).hexdigest()[:8]
        selected_columns.append(
            ("cityHash64", ("'{}'".format(query_hash), "events.issue"), "sample")
        )
        sort_field = "sample"
        orderby = [sort_field]
        referrer = "search_sample"
    else:
        # Get the top matching groups by score, i.e. the actual search results
        # in the order that we want them.
        # ensure stable sort within the same score
        orderby = ["{}".format(sort_field), "events.issue"]
        # orderby = ["-{}".format(sort_field), "events.issue"]
        referrer = "search"

    # Only add as we need fields from groups table? Should groups.last_seen be events.last_seen if we have env filters? Does that break stuff?
    groupby = ["events.issue", "groups.first_seen", "groups.status"]
    snuba_results = snuba.raw_query(
        dataset=snuba.Dataset.Groups,
        start=start,
        end=end,
        selected_columns=selected_columns,
        groupby=groupby,
        conditions=conditions,
        having=having,
        filter_keys=filters,
        aggregations=aggregations,
        orderby=orderby,
        referrer=referrer,
        limit=limit,
        offset=offset,
        totals=True,  # Needs to have totals_mode=after_having_exclusive so we get groups matching HAVING only
        # turbo=get_sample,  # Turn off FINAL when in sampling mode
        # sample=1,  # Don't use clickhouse sampling, even when in turbo mode.
    )
    rows = snuba_results["data"]
    total = snuba_results["totals"]["events.total"]

    if not get_sample:
        metrics.timing("snuba.search.num_result_groups", len(rows))

    structured_results = [(row["events.issue"], row[sort_field]) for row in rows]
    return structured_results, total
