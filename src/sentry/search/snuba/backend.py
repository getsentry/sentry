from __future__ import absolute_import

import six

import logging
import pytz
import time
from datetime import timedelta, datetime

from django.utils import timezone

from sentry import options
from sentry.api.paginator import DateTimePaginator, SequencePaginator, Paginator
from sentry.event_manager import ALLOWED_FUTURE_DELTA
from sentry.models import Release, Group, GroupEnvironment
from sentry.search.django import backend as ds
from sentry.utils import snuba, metrics
from sentry.utils.dates import to_timestamp


logger = logging.getLogger('sentry.search.snuba')
datetime_format = '%Y-%m-%dT%H:%M:%S+00:00'

EMPTY_RESULT = Paginator(Group.objects.none()).get_result()


# TODO: Would be nice if this was handled in the Snuba abstraction, but that
# would require knowledge of which fields are datetimes
def snuba_str_to_datetime(d):
    if not isinstance(d, datetime):
        d = datetime.strptime(d, datetime_format)

    if not d.tzinfo:
        d = d.replace(tzinfo=pytz.utc)

    return d


# mapping from query parameter sort name to underlying scoring aggregation name
sort_strategies = {
    'date': 'last_seen',
    'freq': 'times_seen',
    'new': 'first_seen',
    'priority': 'priority',
}

dependency_aggregations = {
    'priority': ['last_seen', 'times_seen']
}

aggregation_defs = {
    'times_seen': ['count()', ''],
    'first_seen': ['toUInt64(min(timestamp)) * 1000', ''],
    'last_seen': ['toUInt64(max(timestamp)) * 1000', ''],
    # https://github.com/getsentry/sentry/blob/804c85100d0003cfdda91701911f21ed5f66f67c/src/sentry/event_manager.py#L241-L271
    'priority': ['(toUInt64(log(times_seen) * 600)) + last_seen', ''],
    'total': ['uniq', 'issue'],  # Only makes sense with WITH TOTALS, returns 1 for an individual group.
}


class SnubaConditionBuilder(object):
    """\
    Constructions a Snuba conditions list from a ``parameters`` mapping.

    ``Condition`` objects are registered by their parameter name and used to
    construct the Snuba condition list if they are present in the ``parameters``
    mapping.
    """

    def __init__(self, conditions):
        self.conditions = conditions

    def build(self, parameters):
        result = []
        for name, condition in self.conditions.items():
            if name in parameters:
                result.append(condition.apply(name, parameters))
        return result


class Condition(object):
    """\
    Adds a single condition to a Snuba conditions list. Used with
    ``SnubaConditionBuilder``.
    """

    def apply(self, name, parameters):
        raise NotImplementedError


class CallbackCondition(Condition):
    def __init__(self, callback):
        self.callback = callback

    def apply(self, name, parameters):
        return self.callback(parameters[name])


class ScalarCondition(Condition):
    """\
    Adds a scalar filter (less than or greater than are supported) to a Snuba
    condition list. Whether or not the filter is inclusive is defined by the
    '{parameter_name}_inclusive' parameter.
    """

    def __init__(self, field, operator, default_inclusivity=True):
        assert operator in ['<', '>']
        self.field = field
        self.operator = operator
        self.default_inclusivity = default_inclusivity

    def apply(self, name, parameters):
        inclusive = parameters.get(
            u'{}_inclusive'.format(name),
            self.default_inclusivity,
        )

        arg = parameters[name]
        if isinstance(arg, datetime):
            arg = int(to_timestamp(arg)) * 1000

        return (
            self.field,
            self.operator + ('=' if inclusive else ''),
            arg
        )


class SnubaSearchBackend(ds.DjangoSearchBackend):
    def _query(self, projects, retention_window_start, group_queryset, tags, environments,
               sort_by, limit, cursor, count_hits, paginator_options, **parameters):

        # TODO: Product decision: we currently search Group.message to handle
        # the `query` parameter, because that's what we've always done. We could
        # do that search against every event in Snuba instead, but results may
        # differ.

        # TODO: It's possible `first_release` could be handled by Snuba.
        if environments is not None:
            group_queryset = ds.QuerySetBuilder({
                'first_release': ds.CallbackCondition(
                    lambda queryset, version: queryset.extra(
                        where=[
                            '{} = {}'.format(
                                ds.get_sql_column(GroupEnvironment, 'first_release_id'),
                                ds.get_sql_column(Release, 'id'),
                            ),
                            '{} = %s'.format(
                                ds.get_sql_column(Release, 'organization'),
                            ),
                            '{} = %s'.format(
                                ds.get_sql_column(Release, 'version'),
                            ),
                        ],
                        params=[projects[0].organization_id, version],
                        tables=[Release._meta.db_table],
                    ),
                ),
            }).build(
                group_queryset.extra(
                    where=[
                        u'{} = {}'.format(
                            ds.get_sql_column(Group, 'id'),
                            ds.get_sql_column(GroupEnvironment, 'group_id'),
                        ),
                        u'{} IN ({})'.format(
                            ds.get_sql_column(GroupEnvironment, 'environment_id'),
                            ', '.join(['%s' for e in environments])
                        ),
                    ],
                    params=[environment.id for environment in environments],
                    tables=[GroupEnvironment._meta.db_table],
                ),
                parameters,
            )
        else:
            group_queryset = ds.QuerySetBuilder({
                'first_release': ds.CallbackCondition(
                    lambda queryset, version: queryset.filter(
                        first_release__organization_id=projects[0].organization_id,
                        first_release__version=version,
                    ),
                ),
            }).build(
                group_queryset,
                parameters,
            )

        now = timezone.now()
        end = parameters.get('date_to')
        if not end:
            end = now + ALLOWED_FUTURE_DELTA

            # This search is for some time window that ends with "now",
            # so if the requested sort is `date` (`last_seen`) and there
            # are no other Snuba-based search predicates, we can simply
            # return the results from Postgres.
            if cursor is None \
                    and sort_by == 'date' \
                    and not tags \
                    and not environments \
                    and not any(param in parameters for param in [
                        'age_from', 'age_to', 'last_seen_from',
                        'last_seen_to', 'times_seen', 'times_seen_lower',
                        'times_seen_upper'
                    ]):
                group_queryset = group_queryset.order_by('-last_seen')
                paginator = DateTimePaginator(group_queryset, '-last_seen', **paginator_options)
                # When its a simple django-only search, we count_hits like normal
                return paginator.get_result(limit, cursor, count_hits=count_hits)

        # TODO: Presumably we only want to search back to the project's max
        # retention date, which may be closer than 90 days in the past, but
        # apparently `retention_window_start` can be None(?), so we need a
        # fallback.
        retention_date = max(
            filter(None, [
                retention_window_start,
                now - timedelta(days=90)
            ])
        )

        start = max(
            filter(None, [
                retention_date,
                parameters.get('date_from'),
            ])
        )

        end = max([
            retention_date,
            end
        ])

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
        max_candidates = options.get('snuba.search.max-pre-snuba-candidates')
        candidate_ids = list(
            group_queryset.values_list('id', flat=True)[:max_candidates + 1]
        )
        metrics.timing('snuba.search.num_candidates', len(candidate_ids))
        if not candidate_ids:
            # no matches could possibly be found from this point on
            metrics.incr('snuba.search.no_candidates', skip_internal=False)
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
            metrics.incr('snuba.search.too_many_candidates', skip_internal=False)
            candidate_ids = None

        sort_field = sort_strategies[sort_by]
        chunk_growth = options.get('snuba.search.chunk-growth-rate')
        max_chunk_size = options.get('snuba.search.max-chunk-size')
        chunk_limit = limit
        offset = 0
        num_chunks = 0
        hits = None

        paginator_results = EMPTY_RESULT
        result_groups = []
        result_group_ids = set()

        max_time = options.get('snuba.search.max-total-chunk-time-seconds')
        time_start = time.time()

        if count_hits and candidate_ids is None:
            # If we have no candidates, get a random sample of groups matching
            # the snuba side of the query, and see how many of those pass the
            # post-filter in postgres. This should give us an estimate of the
            # total number of snuba matches that will be overall matches, which
            # we can use to get an estimate for X-Hits. Note no cursor, so we
            # are always estimating the total hits.
            snuba_groups, snuba_total = snuba_search(
                start=start,
                end=end,
                project_ids=[p.id for p in projects],
                environment_ids=environments and [environment.id for environment in environments],
                tags=tags,
                sort_field=sort_field,
                get_sample=True,
                **parameters
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
            chunk_limit = max(chunk_limit, len(candidate_ids) if candidate_ids else 0)

            # {group_id: group_score, ...}
            snuba_groups, total = snuba_search(
                start=start,
                end=end,
                project_ids=[p.id for p in projects],
                environment_ids=environments and [environment.id for environment in environments],
                tags=tags,
                sort_field=sort_field,
                cursor=cursor,
                candidate_ids=candidate_ids,
                limit=chunk_limit,
                offset=offset,
                **parameters
            )
            metrics.timing('snuba.search.num_snuba_results', len(snuba_groups))
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
                if count_hits:
                    hits = len(snuba_groups)
            else:
                # pre-filtered candidates were *not* passed down to Snuba,
                # so we need to do post-filtering to verify Sentry DB predicates
                filtered_group_ids = group_queryset.filter(
                    id__in=[gid for gid, _ in snuba_groups]
                ).values_list('id', flat=True)

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

                if count_hits:
                    if not more_results:
                        # We know we have got all possible groups from snuba and filtered
                        # them all down, so we have all hits.
                        # TODO this probably doesn't work because we could be on page N
                        # and not be including hits from previous pages.
                        hits = len(result_groups)
                    else:
                        # We also could have underestimated hits from our sample and have
                        # already seen more hits than the estimate, so make sure hits is
                        # at least as big as what we have seen.
                        hits = max(hits, len(result_groups))

            # TODO do we actually have to rebuild this SequencePaginator every time
            # or can we just make it after we've broken out of the loop?
            paginator_results = SequencePaginator(
                [(score, id) for (id, score) in result_groups],
                reverse=True,
                **paginator_options
            ).get_result(limit, cursor, known_hits=hits)

            # break the query loop for one of three reasons:
            # * we started with Postgres candidates and so only do one Snuba query max
            # * the paginator is returning enough results to satisfy the query (>= the limit)
            # * there are no more groups in Snuba to post-filter
            if candidate_ids \
                    or len(paginator_results.results) >= limit \
                    or not more_results:
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

        metrics.timing('snuba.search.num_chunks', num_chunks)

        groups = Group.objects.in_bulk(paginator_results.results)
        paginator_results.results = [groups[k] for k in paginator_results.results if k in groups]

        return paginator_results


def snuba_search(start, end, project_ids, environment_ids, tags,
                 sort_field, cursor=None, candidate_ids=None, limit=None,
                 offset=0, get_sample=False, **parameters):
    """
    This function doesn't strictly benefit from or require being pulled out of the main
    query method above, but the query method is already large and this function at least
    extracts most of the Snuba-specific logic.

    Returns a tuple of:
     * a sorted list of (group_id, group_score) tuples sorted descending by score,
     * a boolean indicating whether there are more result groups to iterate over
    """

    from sentry.search.base import ANY

    filters = {
        'project_id': project_ids,
    }

    if environment_ids is not None:
        filters['environment'] = environment_ids

    if candidate_ids is not None:
        filters['issue'] = candidate_ids

    having = SnubaConditionBuilder({
        'age_from': ScalarCondition('first_seen', '>'),
        'age_to': ScalarCondition('first_seen', '<'),
        'last_seen_from': ScalarCondition('last_seen', '>'),
        'last_seen_to': ScalarCondition('last_seen', '<'),
        'times_seen': CallbackCondition(
            lambda times_seen: ('times_seen', '=', times_seen),
        ),
        'times_seen_lower': ScalarCondition('times_seen', '>'),
        'times_seen_upper': ScalarCondition('times_seen', '<'),
    }).build(parameters)

    conditions = []
    for tag, val in six.iteritems(tags):
        col = u'tags[{}]'.format(tag)
        if val == ANY:
            conditions.append((col, '!=', ''))
        else:
            conditions.append((col, '=', val))

    extra_aggregations = dependency_aggregations.get(sort_field, [])
    required_aggregations = set([sort_field, 'total'] + extra_aggregations)
    for h in having:
        alias = h[0]
        required_aggregations.add(alias)

    aggregations = []
    for alias in required_aggregations:
        aggregations.append(aggregation_defs[alias] + [alias])

    if cursor is not None:
        having.append((sort_field, '>=' if cursor.is_prev else '<=', cursor.value))

    selected_columns = []
    if get_sample:
        # Get a random sample of matching groups. Because we use any(rand()),
        # we are testing against a single random value per group, and so the
        # sample is independent of the number of events in a group.
        #
        # The number of samples required to achieve a certain error bound with
        # a certain confidence interval can be calculated from a rearrangement
        # of the normal approximation (Wald) confidence interval formula:
        #
        # https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval
        #
        # Effectively if we want the estimate to be within +/- 10% of the real
        # value with 95% confidence, we would need (1.96^2 * p*(1-p)) / 0.1^2
        # samples. With a starting assumption of p=0.5 (this requires the most
        # samples) we would need 96 samples to achieve +/-10% @ 95% confidence.

        limit = options.get('snuba.search.hits-sample-size')
        offset = 0
        selected_columns.append(('any', ('rand', ()), 'sample'))
        sort_field = 'sample'
        orderby = [sort_field]
        referrer = 'search_sample'
    else:
        # Get the top matching groups by score, i.e. the actual search results
        # in the order that we want them.
        orderby = ['-{}'.format(sort_field), 'issue']  # ensure stable sort within the same score
        referrer = 'search'

    snuba_results = snuba.raw_query(
        start=start,
        end=end,
        selected_columns=selected_columns,
        groupby=['issue'],
        conditions=conditions,
        having=having,
        filter_keys=filters,
        aggregations=aggregations,
        orderby=orderby,
        referrer=referrer,
        limit=limit,
        offset=offset,
        totals=True,  # needs to have totals_mode=after_having_exclusive so we get groups matching HAVING only
    )
    rows = snuba_results['data']
    total = snuba_results['totals']['total']

    metrics.timing('snuba.search.num_result_groups', len(rows))

    return [(row['issue'], row[sort_field]) for row in rows], total
