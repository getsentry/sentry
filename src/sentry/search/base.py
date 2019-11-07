from __future__ import absolute_import

import time
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from sentry import options

# from sentry.api.event_search import convert_search_filter_to_snuba_query, InvalidSearchQuery
from sentry.constants import ALLOWED_FUTURE_DELTA

# from sentry.models import Group, Release, GroupEnvironment
from sentry.utils import metrics
from sentry.utils.services import Service


ANY = object()
datetime_format = "%Y-%m-%dT%H:%M:%S+00:00"
dependency_aggregations = {"priority": ["last_seen", "times_seen"]}
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


class QuerySetBuilder(object):
    def __init__(self, conditions):
        self.conditions = conditions

    def build(self, queryset, search_filters):
        for search_filter in search_filters:
            name = search_filter.key.name
            if name in self.conditions:
                condition = self.conditions[name]
                queryset = condition.apply(queryset, search_filter)
        return queryset


class Condition(object):
    """\
    Adds a single filter to a ``QuerySet`` object. Used with
    ``QuerySetBuilder``.
    """

    def apply(self, queryset, name, parameters):
        raise NotImplementedError


class QCallbackCondition(Condition):
    def __init__(self, callback):
        self.callback = callback

    def apply(self, queryset, search_filter):
        from sentry.api.event_search import InvalidSearchQuery

        value = search_filter.value.raw_value
        q = self.callback(value)
        if search_filter.operator not in ("=", "!="):
            raise InvalidSearchQuery(
                u"Operator {} not valid for search {}".format(search_filter.operator, search_filter)
            )
        queryset_method = queryset.filter if search_filter.operator == "=" else queryset.exclude
        queryset = queryset_method(q)
        return queryset


class ScalarCondition(Condition):
    """
    Adds a scalar filter to a ``QuerySet`` object. Only accepts `SearchFilter`
    instances
    """

    OPERATOR_TO_DJANGO = {">=": "gte", "<=": "lte", ">": "gt", "<": "lt"}

    def __init__(self, field, extra=None):
        self.field = field
        self.extra = extra

    def _get_operator(self, search_filter):
        django_operator = self.OPERATOR_TO_DJANGO.get(search_filter.operator, "")
        if django_operator:
            django_operator = "__{}".format(django_operator)
        return django_operator

    def apply(self, queryset, search_filter):
        django_operator = self._get_operator(search_filter)
        qs_method = queryset.exclude if search_filter.operator == "!=" else queryset.filter

        q_dict = {"{}{}".format(self.field, django_operator): search_filter.value.raw_value}
        if self.extra:
            q_dict.update(self.extra)

        return qs_method(**q_dict)


def assigned_to_filter(actor, projects):
    from sentry.models import OrganizationMember, OrganizationMemberTeam, Team

    if isinstance(actor, Team):
        return Q(assignee_set__team=actor)

    teams = Team.objects.filter(
        id__in=OrganizationMemberTeam.objects.filter(
            organizationmember__in=OrganizationMember.objects.filter(
                user=actor, organization_id=projects[0].organization_id
            ),
            is_active=True,
        ).values("team")
    )

    return Q(
        Q(assignee_set__user=actor, assignee_set__project__in=projects)
        | Q(assignee_set__team__in=teams)
    )


def unassigned_filter(unassigned, projects):
    from sentry.models.groupassignee import GroupAssignee

    query = Q(
        id__in=GroupAssignee.objects.filter(project_id__in=[p.id for p in projects]).values_list(
            "group_id", flat=True
        )
    )
    if unassigned:
        query = ~query
    return query


def get_search_filter(search_filters, name, operator):
    """
    Finds the value of a search filter with the passed name and operator. If
    multiple values are found, returns the most restrictive value
    :param search_filters: collection of `SearchFilter` objects
    :param name: Name of the field to find
    :param operator: '<' or '>'
    :return: The value of the field if found, else None
    """
    assert operator in ("<", ">")
    comparator = max if operator.startswith(">") else min
    found_val = None
    for search_filter in search_filters:
        # Note that we check operator with `startswith` here so that we handle
        # <, <=, >, >=
        if search_filter.key.name == name and search_filter.operator.startswith(operator):
            val = search_filter.value.raw_value
            found_val = comparator(val, found_val) if found_val else val
    return found_val


class SearchBackend(Service):
    __read_methods__ = frozenset(["query"])
    __write_methods__ = frozenset()
    __all__ = __read_methods__ | __write_methods__

    def __init__(self, **options):
        pass

    def query(
        self,
        projects,
        tags=None,
        environments=None,
        sort_by="date",
        limit=100,
        cursor=None,
        count_hits=False,
        paginator_options=None,
        search_filters=None,
        date_from=None,
        date_to=None,
        **parameters
    ):
        raise NotImplementedError

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

    def paginator_results_estimator(
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
        from sentry.api.paginator import DateTimePaginator, SequencePaginator, Paginator
        from sentry.models import Group

        EMPTY_RESULT = Paginator(Group.objects.none()).get_result()
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
            # retention. We'll return empty results to maintain backwards compatibility
            # with Django search (for now).
            return EMPTY_RESULT

        if start >= end:
            # TODO: This maintains backwards compatibility with Django search, but
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

        sort_field = self.sort_strategies[sort_by]
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
            snuba_groups, snuba_total = self.snuba_search(
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
            snuba_groups, total = self.snuba_search(
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
