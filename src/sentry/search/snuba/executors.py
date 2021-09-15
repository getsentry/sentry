import logging
import time
from abc import ABCMeta, abstractmethod, abstractproperty
from dataclasses import replace
from datetime import datetime, timedelta
from hashlib import md5
from typing import Any, Mapping, Sequence

import sentry_sdk
from django.db.models import QuerySet
from django.utils import timezone
from snuba_sdk import Direction, Op
from snuba_sdk.query import Column, Condition, Entity, Function, Join, Limit, OrderBy, Query
from snuba_sdk.relationships import Relationship

from sentry import options
from sentry.api.event_search import SearchFilter
from sentry.api.paginator import DateTimePaginator, Paginator, SequencePaginator
from sentry.constants import ALLOWED_FUTURE_DELTA
from sentry.models import Environment, Group, Optional, Project
from sentry.search.events.fields import DateArg
from sentry.search.events.filter import convert_search_filter_to_snuba_query
from sentry.search.utils import validate_cdc_search_filters
from sentry.utils import json, metrics, snuba
from sentry.utils.cursors import Cursor, CursorResult


def get_search_filter(search_filters, name, operator):
    """
    Finds the value of a search filter with the passed name and operator. If
    multiple values are found, returns the most restrictive value
    :param search_filters: collection of `SearchFilter` objects
    :param name: Name of the field to find
    :param operator: '<', '>' or '='
    :return: The value of the field if found, else None
    """
    if not search_filters:
        return None
    assert operator in ("<", ">", "=", "IN")
    comparator = max if operator.startswith(">") else min
    found_val = None
    for search_filter in search_filters:
        # Note that we check operator with `startswith` here so that we handle
        # <, <=, >, >=
        if search_filter.key.name == name and search_filter.operator.startswith(operator):
            val = search_filter.value.raw_value
            found_val = comparator(val, found_val) if found_val else val
    return found_val


class AbstractQueryExecutor(metaclass=ABCMeta):
    """This class serves as a template for Query Executors.
    We subclass it in order to implement query methods (we use it to implement two classes: joined Postgres+Snuba queries, and Snuba only queries)
    It's used to keep the query logic out of the actual search backend,
    which can now just build query parameters and use the appropriate query executor to run the query
    """

    TABLE_ALIAS = ""

    @abstractproperty
    def aggregation_defs(self):
        """This method should return a dict of key:value
        where key is a field name for your aggregation
        and value is the aggregation function"""
        raise NotImplementedError

    @abstractproperty
    def dependency_aggregations(self):
        """This method should return a dict of key:value
        where key is an aggregation_def field name
        and value is a list of aggregation field names that the 'key' aggregation requires."""
        raise NotImplementedError

    @property
    def empty_result(self):
        return Paginator(Group.objects.none()).get_result()

    @property
    @abstractmethod
    def dataset(self):
        """ "This function should return an enum from snuba.Dataset (like snuba.Dataset.Events)"""
        raise NotImplementedError

    @abstractmethod
    def query(
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
        """This function runs your actual query and returns the results
        We usually return a paginator object, which contains the results and the number of hits"""
        raise NotImplementedError

    def snuba_search(
        self,
        start,
        end,
        project_ids,
        environment_ids,
        sort_field,
        organization_id,
        cursor=None,
        group_ids=None,
        limit=None,
        offset=0,
        get_sample=False,
        search_filters=None,
    ):
        """
        Returns a tuple of:
        * a sorted list of (group_id, group_score) tuples sorted descending by score,
        * the count of total results (rows) available for this query.
        """

        filters = {"project_id": project_ids}

        environments = None
        if environment_ids is not None:
            filters["environment"] = environment_ids
            environments = list(
                Environment.objects.filter(
                    organization_id=organization_id, id__in=environment_ids
                ).values_list("name", flat=True)
            )

        if group_ids:
            filters["group_id"] = sorted(group_ids)

        conditions = []
        having = []
        for search_filter in search_filters:
            if (
                # Don't filter on postgres fields here, they're not available
                search_filter.key.name in self.postgres_only_fields
                or
                # We special case date
                search_filter.key.name == "date"
            ):
                continue
            converted_filter = convert_search_filter_to_snuba_query(
                search_filter,
                params={
                    "organization_id": organization_id,
                    "project_id": project_ids,
                    "environment": environments,
                },
            )
            converted_filter = self._transform_converted_filter(
                search_filter, converted_filter, project_ids, environment_ids
            )
            if converted_filter is not None:
                # Ensure that no user-generated tags that clashes with aggregation_defs is added to having
                if search_filter.key.name in self.aggregation_defs and not search_filter.key.is_tag:
                    having.append(converted_filter)
                else:
                    conditions.append(converted_filter)

        extra_aggregations = self.dependency_aggregations.get(sort_field, [])
        required_aggregations = set([sort_field, "total"] + extra_aggregations)
        for h in having:
            alias = h[0]
            required_aggregations.add(alias)

        aggregations = []
        for alias in required_aggregations:
            aggregation = self.aggregation_defs[alias]
            if callable(aggregation):
                # TODO: If we want to expand this pattern we should probably figure out
                # more generic things to pass here.
                aggregation = aggregation(start, end)
            aggregations.append(aggregation + [alias])

        if cursor is not None:
            having.append((sort_field, ">=" if cursor.is_prev else "<=", cursor.value))

        selected_columns = []
        if get_sample:
            query_hash = md5(json.dumps(conditions).encode("utf-8")).hexdigest()[:8]
            selected_columns.append(["cityHash64", [f"'{query_hash}'", "group_id"], "sample"])
            sort_field = "sample"
            orderby = [sort_field]
            referrer = "search_sample"
        else:
            # Get the top matching groups by score, i.e. the actual search results
            # in the order that we want them.
            orderby = [
                f"-{sort_field}",
                "group_id",
            ]  # ensure stable sort within the same score
            referrer = "search"

        snuba_results = snuba.aliased_query(
            dataset=self.dataset,
            start=start,
            end=end,
            selected_columns=selected_columns,
            groupby=["group_id"],
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
            condition_resolver=snuba.get_snuba_column_name,
        )
        rows = snuba_results["data"]
        total = snuba_results["totals"]["total"]

        if not get_sample:
            metrics.timing("snuba.search.num_result_groups", len(rows))

        return [(row["group_id"], row[sort_field]) for row in rows], total

    def _transform_converted_filter(
        self, search_filter, converted_filter, project_ids, environment_ids=None
    ):
        """This method serves as a hook - after we convert the search_filter into a snuba compatible filter (which converts it in a general dataset ambigious method),
        we may want to transform the query - maybe change the value (time formats, translate value into id (like turning Release `version` into `id`) or vice versa),  alias fields, etc.
        By default, no transformation is done.
        """
        return converted_filter

    def has_sort_strategy(self, sort_by):
        return sort_by in self.sort_strategies.keys()


def trend_aggregation(start, end):
    middle = start + timedelta(seconds=(end - start).total_seconds() * 0.5)
    middle = datetime.strftime(middle, DateArg.date_format)

    agg_range_1 = f"countIf(greater(toDateTime('{middle}'), timestamp))"
    agg_range_2 = f"countIf(lessOrEquals(toDateTime('{middle}'), timestamp))"
    return [
        f"if(greater({agg_range_1}, 0), divide({agg_range_2}, {agg_range_1}), 0)",
        "",
    ]


class PostgresSnubaQueryExecutor(AbstractQueryExecutor):
    ISSUE_FIELD_NAME = "group_id"

    logger = logging.getLogger("sentry.search.postgressnuba")
    dependency_aggregations = {"priority": ["last_seen", "times_seen"]}
    postgres_only_fields = {
        "status",
        "for_review",
        "assigned_or_suggested",
        "bookmarked_by",
        "assigned_to",
        "unassigned",
        "linked",
        "subscribed_by",
        "first_release",
        "first_seen",
    }
    sort_strategies = {
        "date": "last_seen",
        "freq": "times_seen",
        "new": "first_seen",
        "priority": "priority",
        "user": "user_count",
        "trend": "trend",
        # We don't need a corresponding snuba field here, since this sort only happens
        # in Postgres
        "inbox": "",
    }

    aggregation_defs = {
        "times_seen": ["count()", ""],
        "first_seen": ["multiply(toUInt64(min(timestamp)), 1000)", ""],
        "last_seen": ["multiply(toUInt64(max(timestamp)), 1000)", ""],
        # https://github.com/getsentry/sentry/blob/804c85100d0003cfdda91701911f21ed5f66f67c/src/sentry/event_manager.py#L241-L271
        "priority": ["toUInt64(plus(multiply(log(times_seen), 600), last_seen))", ""],
        # Only makes sense with WITH TOTALS, returns 1 for an individual group.
        "total": ["uniq", ISSUE_FIELD_NAME],
        "user_count": ["uniq", "tags[sentry:user]"],
        "trend": trend_aggregation,
    }

    @property
    def dataset(self):
        return snuba.Dataset.Events

    def query(
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
        max_hits=None,
    ):

        now = timezone.now()
        end = None
        end_params = [_f for _f in [date_to, get_search_filter(search_filters, "date", "<")] if _f]
        if end_params:
            end = min(end_params)

        if not end:
            end = now + ALLOWED_FUTURE_DELTA

            metrics.incr("snuba.search.postgres_only")

            # This search is for some time window that ends with "now",
            # so if the requested sort is `date` (`last_seen`) and there
            # are no other Snuba-based search predicates, we can simply
            # return the results from Postgres.
            if (
                cursor is None
                and sort_by == "date"
                and
                # This handles tags and date parameters for search filters.
                not [
                    sf
                    for sf in search_filters
                    if sf.key.name not in self.postgres_only_fields.union(["date"])
                ]
            ):
                group_queryset = group_queryset.order_by("-last_seen")
                paginator = DateTimePaginator(group_queryset, "-last_seen", **paginator_options)
                # When its a simple django-only search, we count_hits like normal
                return paginator.get_result(limit, cursor, count_hits=count_hits, max_hits=max_hits)

        # TODO: Presumably we only want to search back to the project's max
        # retention date, which may be closer than 90 days in the past, but
        # apparently `retention_window_start` can be None(?), so we need a
        # fallback.
        retention_date = max(_f for _f in [retention_window_start, now - timedelta(days=90)] if _f)
        start_params = [date_from, retention_date, get_search_filter(search_filters, "date", ">")]
        start = max(_f for _f in start_params if _f)
        end = max([retention_date, end])

        if start == retention_date and end == retention_date:
            # Both `start` and `end` must have been trimmed to `retention_date`,
            # so this entire search was against a time range that is outside of
            # retention. We'll return empty results to maintain backwards compatibility
            # with Django search (for now).
            return self.empty_result

        if start >= end:
            # TODO: This maintains backwards compatibility with Django search, but
            # in the future we should find a way to notify the user that their search
            # is invalid.
            return self.empty_result

        # Here we check if all the django filters reduce the set of groups down
        # to something that we can send down to Snuba in a `group_id IN (...)`
        # clause.
        max_candidates = options.get("snuba.search.max-pre-snuba-candidates")

        with sentry_sdk.start_span(op="snuba_group_query") as span:
            group_ids = list(group_queryset.values_list("id", flat=True)[: max_candidates + 1])
            span.set_data("Max Candidates", max_candidates)
            span.set_data("Result Size", len(group_ids))
        metrics.timing("snuba.search.num_candidates", len(group_ids))

        too_many_candidates = False
        if not group_ids:
            # no matches could possibly be found from this point on
            metrics.incr("snuba.search.no_candidates", skip_internal=False)
            return self.empty_result
        elif len(group_ids) > max_candidates:
            # If the pre-filter query didn't include anything to significantly
            # filter down the number of results (from 'first_release', 'status',
            # 'bookmarked_by', 'assigned_to', 'unassigned', or 'subscribed_by')
            # then it might have surpassed the `max_candidates`. In this case,
            # we *don't* want to pass candidates down to Snuba, and instead we
            # want Snuba to do all the filtering/sorting it can and *then* apply
            # this queryset to the results from Snuba, which we call
            # post-filtering.
            metrics.incr("snuba.search.too_many_candidates", skip_internal=False)
            too_many_candidates = True
            group_ids = []

        sort_field = self.sort_strategies[sort_by]
        chunk_growth = options.get("snuba.search.chunk-growth-rate")
        max_chunk_size = options.get("snuba.search.max-chunk-size")
        chunk_limit = limit
        offset = 0
        num_chunks = 0
        hits = self.calculate_hits(
            group_ids,
            too_many_candidates,
            sort_field,
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
            start,
            end,
        )
        if count_hits and hits == 0:
            return self.empty_result

        paginator_results = self.empty_result
        result_groups = []
        result_group_ids = set()

        max_time = options.get("snuba.search.max-total-chunk-time-seconds")
        time_start = time.time()

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
            # but if we have group_ids always query for at least that many items
            chunk_limit = max(chunk_limit, len(group_ids))

            # {group_id: group_score, ...}
            snuba_groups, total = self.snuba_search(
                start=start,
                end=end,
                project_ids=[p.id for p in projects],
                environment_ids=environments and [environment.id for environment in environments],
                organization_id=projects[0].organization_id,
                sort_field=sort_field,
                cursor=cursor,
                group_ids=group_ids,
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

            if group_ids:
                # pre-filtered candidates were passed down to Snuba, so we're
                # finished with filtering and these are the only results. Note
                # that because we set the chunk size to at least the size of
                # the group_ids, we know we got all of them (ie there are
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

            # break the query loop for one of three reasons:
            # * we started with Postgres candidates and so only do one Snuba query max
            # * the paginator is returning enough results to satisfy the query (>= the limit)
            # * there are no more groups in Snuba to post-filter
            # TODO do we actually have to rebuild this SequencePaginator every time
            # or can we just make it after we've broken out of the loop?
            paginator_results = SequencePaginator(
                [(score, id) for (id, score) in result_groups], reverse=True, **paginator_options
            ).get_result(limit, cursor, known_hits=hits, max_hits=max_hits)

            if group_ids or len(paginator_results.results) >= limit or not more_results:
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

    def calculate_hits(
        self,
        group_ids,
        too_many_candidates,
        sort_field,
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
        start,
        end,
    ):
        """
        This method should return an integer representing the number of hits (results) of your search.
        It will return 0 if hits were calculated and there are none.
        It will return None if hits were not calculated.
        """
        if count_hits is False:
            return None
        elif too_many_candidates or cursor is not None:
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
            kwargs = dict(
                start=start,
                end=end,
                project_ids=[p.id for p in projects],
                environment_ids=environments and [environment.id for environment in environments],
                organization_id=projects[0].organization_id,
                sort_field=sort_field,
                limit=sample_size,
                offset=0,
                get_sample=True,
                search_filters=search_filters,
            )
            if not too_many_candidates:
                kwargs["group_ids"] = group_ids

            snuba_groups, snuba_total = self.snuba_search(**kwargs)
            snuba_count = len(snuba_groups)
            if snuba_count == 0:
                # Maybe check for 0 hits and return EMPTY_RESULT in ::query? self.empty_result
                return 0
            else:
                filtered_count = group_queryset.filter(
                    id__in=[gid for gid, _ in snuba_groups]
                ).count()

                hit_ratio = filtered_count / float(snuba_count)
                hits = int(hit_ratio * snuba_total)
                return hits

        return None


class InvalidQueryForExecutor(Exception):
    pass


class CdcPostgresSnubaQueryExecutor(PostgresSnubaQueryExecutor):
    sort_strategies = {
        "date": "last_seen",
        "freq": "times_seen",
        "new": "first_seen",
        "priority": "priority",
        "user": "user_count",
    }

    entities = {
        "event": Entity("events", alias="e"),
        "group": Entity("groupedmessage", alias="g"),
    }
    times_seen_aggregation = Function("count", [Column("group_id", entities["event"])])
    first_seen_aggregation = Function(
        "multiply",
        [
            Function("toUInt64", [Function("min", [Column("timestamp", entities["event"])])]),
            1000,
        ],
    )
    last_seen_aggregation = Function(
        "multiply",
        [
            Function("toUInt64", [Function("max", [Column("timestamp", entities["event"])])]),
            1000,
        ],
    )

    aggregation_defs = {
        "times_seen": times_seen_aggregation,
        "first_seen": first_seen_aggregation,
        "last_seen": last_seen_aggregation,
        # https://github.com/getsentry/sentry/blob/804c85100d0003cfdda91701911f21ed5f66f67c/src/sentry/event_manager.py#L241-L271
        "priority": Function(
            "toUInt64",
            [
                Function(
                    "plus",
                    [
                        Function(
                            "multiply",
                            [
                                Function(
                                    "log",
                                    [times_seen_aggregation],
                                ),
                                600,
                            ],
                        ),
                        last_seen_aggregation,
                    ],
                )
            ],
        ),
        "user_count": Function("uniq", [Column("tags[sentry:user]", entities["event"])]),
    }

    def calculate_start_end(
        self,
        retention_window_start: Optional[datetime],
        search_filters: Sequence[SearchFilter],
        date_from: Optional[datetime],
        date_to: Optional[datetime],
    ):
        now = timezone.now()
        end = None
        end_params = [_f for _f in [date_to, get_search_filter(search_filters, "date", "<")] if _f]
        if end_params:
            end = min(end_params)

        if not end:
            end = now + ALLOWED_FUTURE_DELTA

        retention_date = max(_f for _f in [retention_window_start, now - timedelta(days=90)] if _f)
        start_params = [date_from, retention_date, get_search_filter(search_filters, "date", ">")]
        start = max(_f for _f in start_params if _f)
        end = max([retention_date, end])
        return start, end, retention_date

    def query(
        self,
        projects: Sequence[Project],
        retention_window_start: Optional[datetime],
        group_queryset: QuerySet,
        environments: Sequence[Environment],
        sort_by: str,
        limit: int,
        cursor: Optional[Cursor],
        count_hits: bool,
        paginator_options: Mapping[str, Any],
        search_filters: Sequence[SearchFilter],
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        max_hits=None,
    ) -> CursorResult:

        if not validate_cdc_search_filters(search_filters):
            raise InvalidQueryForExecutor("Search filters invalid for this query executor")

        start, end, retention_date = self.calculate_start_end(
            retention_window_start, search_filters, date_from, date_to
        )

        if start == retention_date and end == retention_date:
            # Both `start` and `end` must have been trimmed to `retention_date`,
            # so this entire search was against a time range that is outside of
            # retention. We'll return empty results to maintain backwards compatibility
            # with Django search (for now).
            return self.empty_result

        if start >= end:
            # TODO: This maintains backwards compatibility with Django search, but
            # in the future we should find a way to notify the user that their search
            # is invalid.
            return self.empty_result

        e_event = self.entities["event"]
        e_group = self.entities["group"]

        where_conditions = [
            Condition(Column("project_id", e_event), Op.IN, [p.id for p in projects]),
            Condition(Column("timestamp", e_event), Op.GTE, start),
            Condition(Column("timestamp", e_event), Op.LT, end),
        ]
        # TODO: This is still basically only handling status, handle this better once we introduce
        # more conditions.
        for search_filter in search_filters:
            where_conditions.append(
                Condition(
                    Column(search_filter.key.name, e_group), Op.IN, search_filter.value.raw_value
                )
            )

        if environments:
            # TODO: Should this be handled via filter_keys, once we have a snql compatible version?
            where_conditions.append(
                Condition(Column("environment", e_event), Op.IN, [e.name for e in environments])
            )

        sort_func = self.aggregation_defs[self.sort_strategies[sort_by]]

        having = []
        if cursor is not None:
            op = Op.GTE if cursor.is_prev else Op.LTE
            having.append(Condition(sort_func, op, cursor.value))

        query = Query(
            "events",
            match=Join([Relationship(e_event, "grouped", e_group)]),
            select=[
                Column("id", e_group),
                replace(sort_func, alias="score"),
            ],
            where=where_conditions,
            groupby=[Column("id", e_group)],
            having=having,
            orderby=[OrderBy(sort_func, direction=Direction.DESC)],
            limit=Limit(limit + 1),
        )

        data = snuba.raw_snql_query(query, referrer="search.snuba.cdc_search.query")["data"]

        hits_query = Query(
            "events",
            match=Join([Relationship(e_event, "grouped", e_group)]),
            select=[
                Function("uniq", [Column("id", e_group)], alias="count"),
            ],
            where=where_conditions,
        )
        hits = None
        if count_hits:
            hits = snuba.raw_snql_query(hits_query, referrer="search.snuba.cdc_search.hits")[
                "data"
            ][0]["count"]

        paginator_results = SequencePaginator(
            [(row["score"], row["g.id"]) for row in data], reverse=True, **paginator_options
        ).get_result(limit, cursor, known_hits=hits, max_hits=max_hits)
        # We filter against `group_queryset` here so that we recheck all conditions in Postgres.
        # Since replag between Postgres and Clickhouse can happen, we might get back results that
        # have changed state in Postgres. By rechecking them we guarantee than any returned results
        # have the correct state.
        # TODO: This can result in us returning less than a full page of results, but shouldn't
        # affect cursors. If we want to, we can iterate and query snuba until we manage to get a
        # full page. In practice, this will likely only skip a couple of results at worst, and
        # probably not be noticeable to the user, so holding off for now to reduce complexity.
        groups = group_queryset.in_bulk(paginator_results.results)
        paginator_results.results = [groups[k] for k in paginator_results.results if k in groups]
        return paginator_results
