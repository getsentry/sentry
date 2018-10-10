from __future__ import absolute_import

import six

import logging
import math
import pytz
import time
from collections import defaultdict
from datetime import timedelta, datetime

from django.utils import timezone

from sentry import options
from sentry.api.paginator import SequencePaginator, Paginator
from sentry.event_manager import ALLOWED_FUTURE_DELTA
from sentry.models import Release, Group, GroupEnvironment, GroupHash
from sentry.search.django import backend as ds
from sentry.utils import snuba, metrics
from sentry.utils.dates import to_timestamp


logger = logging.getLogger('sentry.search.snuba')
datetime_format = '%Y-%m-%dT%H:%M:%S+00:00'


# TODO: Would be nice if this was handled in the Snuba abstraction, but that
# would require knowledge of which fields are datetimes
def snuba_str_to_datetime(d):
    if not isinstance(d, datetime):
        d = datetime.strptime(d, datetime_format)

    if not d.tzinfo:
        d = d.replace(tzinfo=pytz.utc)

    return d


def calculate_priority_cursor(data):
    times_seen = sum(data['times_seen'])
    last_seen = max(int(to_timestamp(snuba_str_to_datetime(d)) * 1000) for d in data['last_seen'])
    return ((math.log(times_seen) * 600) + last_seen)


def _datetime_cursor_calculator(field, fn):
    def calculate(data):
        datetime = fn(snuba_str_to_datetime(d) for d in data[field])
        return int(to_timestamp(datetime) * 1000)

    return calculate


sort_strategies = {
    # sort_by -> Tuple[
    #   String: column or alias to sort by (of type T, used below),
    #   List[String]: extra aggregate columns required for this sorting strategy,
    #   Function[T] -> int: function for converting a group's data to a cursor value),
    # ]
    'priority': (
        'priority', ['last_seen', 'times_seen'], calculate_priority_cursor,
    ),
    'date': (
        'last_seen', [], _datetime_cursor_calculator('last_seen', max),
    ),
    'new': (
        'first_seen', [], _datetime_cursor_calculator('first_seen', min),
    ),
    'freq': (
        'times_seen', [], lambda data: sum(data['times_seen']),
    ),
}


aggregation_defs = {
    'times_seen': ['count()', ''],
    'first_seen': ['min', 'timestamp'],
    'last_seen': ['max', 'timestamp'],
    # https://github.com/getsentry/sentry/blob/804c85100d0003cfdda91701911f21ed5f66f67c/src/sentry/event_manager.py#L241-L271
    'priority': ['toUInt32(log(times_seen) * 600) + toUInt32(last_seen)', ''],
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
            arg = int(to_timestamp(arg))

        return (
            self.field,
            self.operator + ('=' if inclusive else ''),
            arg
        )


class SnubaSearchBackend(ds.DjangoSearchBackend):
    def _query(self, project, retention_window_start, group_queryset, tags, environment,
               sort_by, limit, cursor, count_hits, paginator_options, **parameters):

        # TODO: Product decision: we currently search Group.message to handle
        # the `query` parameter, because that's what we've always done. We could
        # do that search against every event in Snuba instead, but results may
        # differ.

        db_name = options.get('snuba.search.django-database-name')

        now = timezone.now()
        end = parameters.get('date_to') or (now + ALLOWED_FUTURE_DELTA)
        # TODO: Presumably we want to search back to the project's full retention,
        #       which may be higher than 90 days in the past, but apparently
        #       `retention_window_start` can be None(?), so we need a fallback.
        start = max(
            filter(None, [
                retention_window_start,
                parameters.get('date_from'),
                now - timedelta(days=90)
            ])
        )
        assert start < end

        # TODO: It's possible `first_release` could be handled by Snuba.
        if environment is not None:
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
                        params=[project.organization_id, version],
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
                        u'{} = %s'.format(
                            ds.get_sql_column(GroupEnvironment, 'environment_id'),
                        ),
                    ],
                    params=[environment.id],
                    tables=[GroupEnvironment._meta.db_table],
                ),
                parameters,
            )
        else:
            group_queryset = ds.QuerySetBuilder({
                'first_release': ds.CallbackCondition(
                    lambda queryset, version: queryset.filter(
                        first_release__organization_id=project.organization_id,
                        first_release__version=version,
                    ),
                ),
            }).build(
                group_queryset,
                parameters,
            )

        # maximum number of GroupHashes to send down to Snuba,
        # if more GroupHash candidates are found, a "bare" Snuba
        # search is performed and the result groups are then
        # post-filtered via queries to the Sentry DB
        max_pre_snuba_candidates = options.get('snuba.search.max-pre-snuba-candidates')

        # pre-filter query
        candidate_hashes = None
        if max_pre_snuba_candidates and limit <= max_pre_snuba_candidates:
            candidate_hashes = dict(
                GroupHash.objects.using(db_name).filter(
                    group__in=group_queryset
                ).values_list(
                    'hash', 'group_id'
                )[:max_pre_snuba_candidates + 1]
            )
            metrics.timing('snuba.search.num_candidates', len(candidate_hashes))

            if not candidate_hashes:
                # no matches could possibly be found from this point on
                metrics.incr('snuba.search.no_candidates')
                return Paginator(Group.objects.none()).get_result()
            elif len(candidate_hashes) > max_pre_snuba_candidates:
                # If the pre-filter query didn't include anything to significantly
                # filter down the number of results (from 'first_release', 'query',
                # 'status', 'bookmarked_by', 'assigned_to', 'unassigned',
                # 'subscribed_by', 'active_at_from', or 'active_at_to') then it
                # might have surpassed the `max_pre_snuba_candidates`. In this case,
                # we *don't* want to pass candidates down to Snuba, and instead we
                # want Snuba to do all the filtering/sorting it can and *then* apply
                # this queryset to the results from Snuba, which we call
                # post-filtering.
                metrics.incr('snuba.search.too_many_candidates')
                candidate_hashes = None

        sort, extra_aggregations, score_fn = sort_strategies[sort_by]

        chunk_growth = options.get('snuba.search.chunk-growth-rate')
        max_chunk_size = options.get('snuba.search.max-chunk-size')
        chunk_limit = limit
        offset = 0
        num_chunks = 0

        paginator_results = Paginator(Group.objects.none()).get_result()
        result_groups = []
        result_group_ids = set()
        min_score = float('inf')
        max_score = -1

        max_time = options.get('snuba.search.max-total-chunk-time-seconds')
        time_start = time.time()

        # Do smaller searches in chunks until we have enough results
        # to answer the query (or hit the end of possible results). We do
        # this because a common case for search is to return 100 groups
        # sorted by `last_seen`, and we want to avoid returning all of
        # a project's hashes and then post-sorting them all in Postgres
        # when typically the first N results will do.
        while (time.time() - time_start) < max_time:
            num_chunks += 1

            # grow the chunk size on each iteration to account for huge projects
            # and weird queries, up to a max size
            chunk_limit = min(int(chunk_limit * chunk_growth), max_chunk_size)
            # but if we have candidate_hashes always query for at least that many items
            chunk_limit = max(chunk_limit, len(candidate_hashes) if candidate_hashes else 0)

            # {group_id: group_score, ...}
            snuba_groups, more_results = snuba_search(
                project_id=project.id,
                environment_id=environment and environment.id,
                tags=tags,
                start=start,
                end=end,
                sort=sort,
                extra_aggregations=extra_aggregations,
                score_fn=score_fn,
                candidate_hashes=candidate_hashes,
                limit=chunk_limit,
                offset=offset,
                db_name=db_name,
                **parameters
            )
            metrics.timing('snuba.search.num_snuba_results', len(snuba_groups))
            offset += len(snuba_groups)

            if not snuba_groups:
                break

            if candidate_hashes:
                # pre-filtered candidates were passed down to Snuba,
                # so we're finished with filtering and these are the
                # only results
                result_groups = snuba_groups
            else:
                # pre-filtered candidates were *not* passed down to Snuba,
                # so we need to do post-filtering to verify Sentry DB predicates
                filtered_group_ids = group_queryset.using(db_name).filter(
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

                    # used for cursor logic
                    min_score = min(min_score, group_score)
                    max_score = max(max_score, group_score)

            # HACK: If a cursor is being used and there may be more results available
            # in Snuba, we need to detect whether the cursor's value will be
            # found in the result groups. If it isn't in the results yet we need to
            # continue querying before we hand off to the paginator to decide whether
            # enough results are found or not, otherwise the paginator will happily
            # return `limit` worth of results that don't take the cursor into account
            # at all, since it can't know there are more results available.
            # TODO: If chunked search works in practice we should probably extend the
            # paginator to throw something if the cursor value is never found, or do
            # something other than partially leak internal paginator logic up to here.
            # Or make separate Paginator implementation just for Snuba search?
            if cursor is not None \
                    and not candidate_hashes \
                    and more_results:
                if cursor.is_prev and min_score < cursor.value:
                    continue
                elif not cursor.is_prev and max_score > cursor.value:
                    continue

            paginator_results = SequencePaginator(
                [(score, id) for (id, score) in result_groups],
                reverse=True,
                **paginator_options
            ).get_result(limit, cursor, count_hits=False)

            # break the query loop for one of three reasons:
            # * we started with Postgres candidates and so only do one Snuba query max
            # * the paginator is returning enough results to satisfy the query (>= the limit)
            # * there are no more groups in Snuba to post-filter
            if candidate_hashes \
                    or len(paginator_results.results) >= limit \
                    or not more_results:
                break

        metrics.timing('snuba.search.num_chunks', num_chunks)

        groups = Group.objects.using(db_name).in_bulk(paginator_results.results)
        paginator_results.results = [groups[k] for k in paginator_results.results if k in groups]

        return paginator_results


def snuba_search(project_id, environment_id, tags, start, end,
                 sort, extra_aggregations, score_fn, candidate_hashes,
                 limit, offset, db_name, **parameters):
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
        'project_id': [project_id],
    }

    if environment_id is not None:
        filters['environment'] = [environment_id]

    if candidate_hashes is not None:
        filters['primary_hash'] = candidate_hashes.keys()

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

    required_aggregations = set([sort] + extra_aggregations)
    for h in having:
        alias = h[0]
        required_aggregations.add(alias)

    aggregations = []
    for alias in required_aggregations:
        aggregations.append(aggregation_defs[alias] + [alias])

    # {hash -> {<agg_alias> -> <agg_value>,
    #           <agg_alias> -> <agg_value>,
    #           ...},
    #  ...}
    # _OR_ if there's only one <agg_alias> in use
    # {hash -> <agg_value>,
    #  ...}
    snuba_results = snuba.query(
        start=start,
        end=end,
        groupby=['primary_hash'],
        conditions=conditions,
        having=having,
        filter_keys=filters,
        aggregations=aggregations,
        orderby='-' + sort,
        referrer='search',
        limit=limit + 1,
        offset=offset,
    )
    metrics.timing('snuba.search.num_result_hashes', len(snuba_results.keys()))
    more_results = len(snuba_results) == limit + 1

    # {hash -> group_id, ...}
    if candidate_hashes is not None:
        # any hash coming back had to come from our candidate set
        hash_to_group = candidate_hashes
    else:
        hash_to_group = dict(
            GroupHash.objects.using(db_name).filter(
                project_id=project_id,
                hash__in=snuba_results.keys()
            ).values_list(
                'hash', 'group_id'
            )
        )

    # {group_id -> {field1: [...all values from field1 for all hashes...],
    #               field2: [...all values from field2 for all hashes...]
    #               ...}
    #  ...}
    group_data = {}
    for hash, obj in snuba_results.items():
        if hash in hash_to_group:
            group_id = hash_to_group[hash]

            if group_id not in group_data:
                group_data[group_id] = defaultdict(list)

            dest = group_data[group_id]

            # NOTE: The Snuba utility code is trying to be helpful by collapsing
            # results with only one aggregate down to the single value. It's a
            # bit of a hack that we then immediately undo that work here, but
            # many other callers get value out of that functionality. If we see
            # this pattern again we should either add an option to opt-out of
            # the 'help' here or remove it from the Snuba code altogether.
            if len(required_aggregations) == 1:
                alias = list(required_aggregations)[0]
                dest[alias].append(obj)
            else:
                for k, v in obj.items():
                    dest[k].append(v)
        else:
            logger.warning(
                'search.hash_not_found',
                extra={
                    'project_id': project_id,
                    'hash': hash,
                },
            )

    return (
        list(
            sorted(
                ((gid, score_fn(data)) for gid, data in group_data.items()),
                key=lambda t: t[1], reverse=True
            )
        )[:limit], more_results
    )
