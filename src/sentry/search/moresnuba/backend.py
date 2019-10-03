from __future__ import absolute_import

import datetime
import functools
import time
from datetime import timedelta
from hashlib import md5

from django.db.models import Q
from django.utils import timezone

from sentry import options, quotas
from sentry.api.event_search import convert_search_filter_to_snuba_query, TAG_KEY_RE
from sentry.api.paginator import DateTimePaginator, SequencePaginator
from sentry.constants import ALLOWED_FUTURE_DELTA
from sentry.models import Group
from sentry.utils import snuba, metrics
from sentry.search.snuba.base import (
    SnubaSearchBackendBase,
    QCallbackCondition,
    QuerySetBuilder,
    assigned_to_filter,
    unassigned_filter,
    get_search_filter,
    EMPTY_RESULT,
    logger,
    dependency_aggregations,
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

        now = timezone.now()
        end = None
        end_params = filter(None, [date_to, get_search_filter(search_filters, "date", "<")])
        if end_params:
            end = min(end_params)

        if not end:
            end = now + ALLOWED_FUTURE_DELTA

            # This search is for some time window that ends with "now",
            # so if the requested sort is `date` (`last_seen`) and there
            # are no other Snuba-based search predicates, we can simply
            # return the results from Postgres.
            if (
                cursor is None
                and sort_by == "date"
                and not environments
                and
                # This handles tags and date parameters for search filters.
                not [
                    sf
                    for sf in search_filters
                    if sf.key.name not in issue_only_fields.union(["date"])
                ]
            ):
                group_queryset = group_queryset.order_by("-last_seen")
                paginator = DateTimePaginator(group_queryset, "-last_seen", **paginator_options)
                # When its a simple django-only search, we count_hits like normal
                return paginator.get_result(limit, cursor, count_hits=count_hits)

        # TODO: Presumably we only want to search back to the project's max
        # retention date, which may be closer than 90 days in the past, but
        # apparently `retention_window_start` can be None(?), so we need a
        # fallback.
        retention_date = max(filter(None, [retention_window_start, now - timedelta(days=90)]))

        # TODO: We should try and consolidate all this logic together a little
        # better, maybe outside the backend. Should be easier once we're on
        # just the new search filters
        start_params = [date_from, retention_date, get_search_filter(search_filters, "date", ">")]
        start = max(filter(None, start_params))

        end = max([retention_date, end])
        if start == retention_date and end == retention_date:
            # Both `start` and `end` must have been trimmed to `retention_date`,
            # so this entire search was against a time range that is outside of
            # retention. We'll return empty results to maintain backwards compatability
            # with Django search (for now).
            return EMPTY_RESULT

        if start >= end:
            # TODO: This maintains backwards compatability with Django search, but
            # in the future we should find a way to notify the user that their search
            # is invalid.
            return EMPTY_RESULT

        # Here we check if all the django filters reduce the set of groups down
        # to something that we can send down to Snuba in a `group_id IN (...)`
        # clause.
        max_candidates = options.get("snuba.search.max-pre-snuba-candidates")
        too_many_candidates = False
        candidate_ids = list(group_queryset.values_list("id", flat=True)[: max_candidates + 1])
        metrics.timing("snuba.search.num_candidates", len(candidate_ids))
        if not candidate_ids:
            # no matches could possibly be found from this point on
            metrics.incr("snuba.search.no_candidates", skip_internal=False)
            return EMPTY_RESULT
        elif len(candidate_ids) > max_candidates:
            # If the pre-filter query didn't include anything to significantly
            # filter down the number of results (from 'first_release', 'query',
            # 'status', 'bookmarked_by', 'assigned_to', 'unassigned',
            # 'subscribed_by', 'active_at_from', or 'active_at_to') then it
            # might have surpassed the `max_candidates`. In this case,
            # we *don't* want to pass candidates down to Snuba, and instead we
            # want Snuba to do all the filtering/sorting it can and *then* apply
            # this queryset to the results from Snuba, which we call
            # post-filtering.
            metrics.incr("snuba.search.too_many_candidates", skip_internal=False)
            too_many_candidates = True
            candidate_ids = []

        sort_field = sort_strategies[sort_by]
        chunk_growth = options.get("snuba.search.chunk-growth-rate")
        max_chunk_size = options.get("snuba.search.max-chunk-size")
        chunk_limit = limit
        offset = 0
        num_chunks = 0
        hits = None

        paginator_results = EMPTY_RESULT
        result_groups = []
        result_group_ids = set()

        max_time = options.get("snuba.search.max-total-chunk-time-seconds")
        time_start = time.time()

        if count_hits and (too_many_candidates or cursor is not None):
            # If we had too many candidates to reasonably pass down to snuba,
            # or if we have a cursor that bisects the overall result set (such
            # that our query only sees results on one side of the cursor) then
            # we need an alternative way to figure out the total hits that this
            # query has.

            # To do this, we get a sample of groups matching the snuba side of
            # the query, and see how many of those pass the post-filter in
            # postgres. This should give us an estimate of the total number of
            # snuba matches that will be overall matches, which we can use to
            # get an estimate for X-Hits.

            # The sampling is not simple random sampling. It will return *all*
            # matching groups if there are less than N groups matching the
            # query, or it will return a random, deterministic subset of N of
            # the groups if there are more than N overall matches. This means
            # that the "estimate" is actually an accurate result when there are
            # less than N matching groups.

            # The number of samples required to achieve a certain error bound
            # with a certain confidence interval can be calculated from a
            # rearrangement of the normal approximation (Wald) confidence
            # interval formula:
            #
            # https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval
            #
            # Effectively if we want the estimate to be within +/- 10% of the
            # real value with 95% confidence, we would need (1.96^2 * p*(1-p))
            # / 0.1^2 samples. With a starting assumption of p=0.5 (this
            # requires the most samples) we would need 96 samples to achieve
            # +/-10% @ 95% confidence.

            sample_size = options.get("snuba.search.hits-sample-size")
            snuba_groups, snuba_total = snuba_search(
                start=start,
                end=end,
                project_ids=[p.id for p in projects],
                environment_ids=environments and [environment.id for environment in environments],
                sort_field=sort_field,
                limit=sample_size,
                offset=0,
                get_sample=True,
                search_filters=search_filters,
            )
            snuba_count = len(snuba_groups)
            if snuba_count == 0:
                return EMPTY_RESULT
            else:
                filtered_count = group_queryset.filter(
                    id__in=[gid for gid, _ in snuba_groups]
                ).count()

                hit_ratio = filtered_count / float(snuba_count)
                hits = int(hit_ratio * snuba_total)

        # Do smaller searches in chunks until we have enough results
        # to answer the query (or hit the end of possible results). We do
        # this because a common case for search is to return 100 groups
        # sorted by `last_seen`, and we want to avoid returning all of
        # a project's groups and then post-sorting them all in Postgres
        # when typically the first N results will do.
        while (time.time() - time_start) < max_time:
            num_chunks += 1

            # grow the chunk size on each iteration to account for huge projects
            # and weird queries, up to a max size
            chunk_limit = min(int(chunk_limit * chunk_growth), max_chunk_size)
            # but if we have candidate_ids always query for at least that many items
            chunk_limit = max(chunk_limit, len(candidate_ids))

            # {group_id: group_score, ...}
            snuba_groups, total = snuba_search(
                start=start,
                end=end,
                project_ids=[p.id for p in projects],
                environment_ids=environments and [environment.id for environment in environments],
                sort_field=sort_field,
                cursor=cursor,
                candidate_ids=candidate_ids,
                limit=chunk_limit,
                offset=offset,
                search_filters=search_filters,
            )
            metrics.timing("snuba.search.num_snuba_results", len(snuba_groups))
            count = len(snuba_groups)
            more_results = count >= limit and (offset + limit) < total
            offset += len(snuba_groups)

            if not snuba_groups:
                break

            if candidate_ids:
                # pre-filtered candidates were passed down to Snuba, so we're
                # finished with filtering and these are the only results. Note
                # that because we set the chunk size to at least the size of
                # the candidate_ids, we know we got all of them (ie there are
                # no more chunks after the first)
                result_groups = snuba_groups
                if count_hits and hits is None:
                    hits = len(snuba_groups)
            else:
                # pre-filtered candidates were *not* passed down to Snuba,
                # so we need to do post-filtering to verify Sentry DB predicates
                filtered_group_ids = group_queryset.filter(
                    id__in=[gid for gid, _ in snuba_groups]
                ).values_list("id", flat=True)

                group_to_score = dict(snuba_groups)
                for group_id in filtered_group_ids:
                    if group_id in result_group_ids:
                        # because we're doing multiple Snuba queries, which
                        # happen outside of a transaction, there is a small possibility
                        # of groups moving around in the sort scoring underneath us,
                        # so we at least want to protect against duplicates
                        continue

                    group_score = group_to_score[group_id]
                    result_group_ids.add(group_id)
                    result_groups.append((group_id, group_score))

            # TODO do we actually have to rebuild this SequencePaginator every time
            # or can we just make it after we've broken out of the loop?
            paginator_results = SequencePaginator(
                [(score, id) for (id, score) in result_groups], reverse=True, **paginator_options
            ).get_result(limit, cursor, known_hits=hits)

            # break the query loop for one of three reasons:
            # * we started with Postgres candidates and so only do one Snuba query max
            # * the paginator is returning enough results to satisfy the query (>= the limit)
            # * there are no more groups in Snuba to post-filter
            if candidate_ids or len(paginator_results.results) >= limit or not more_results:
                break

        # HACK: We're using the SequencePaginator to mask the complexities of going
        # back and forth between two databases. This causes a problem with pagination
        # because we're 'lying' to the SequencePaginator (it thinks it has the entire
        # result set in memory when it does not). For this reason we need to make some
        # best guesses as to whether the `prev` and `next` cursors have more results.

        if len(paginator_results.results) == limit and more_results:
            # Because we are going back and forth between DBs there is a small
            # chance that we will hand the SequencePaginator exactly `limit`
            # items. In this case the paginator will assume there are no more
            # results, so we need to override the `next` cursor's results.
            paginator_results.next.has_results = True

        if cursor is not None and (not cursor.is_prev or len(paginator_results.results) > 0):
            # If the user passed a cursor, and it isn't already a 0 result `is_prev`
            # cursor, then it's worth allowing them to go back a page to check for
            # more results.
            paginator_results.prev.has_results = True

        metrics.timing("snuba.search.num_chunks", num_chunks)

        groups = Group.objects.in_bulk(paginator_results.results)
        paginator_results.results = [groups[k] for k in paginator_results.results if k in groups]

        return paginator_results


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
