from __future__ import absolute_import

import six

import logging
import math
import pytz
from collections import defaultdict, OrderedDict
from datetime import timedelta, datetime

from django.utils import timezone

from sentry.api.paginator import SequencePaginator, Paginator
from sentry.event_manager import ALLOWED_FUTURE_DELTA
from sentry.models import Release, Group, GroupEnvironment, GroupHash
from sentry.search.django import backend as ds
from sentry.utils import snuba, metrics
from sentry.utils.dates import to_timestamp
from sentry.utils.iterators import chunked


logger = logging.getLogger('sentry.search.snuba')
datetime_format = '%Y-%m-%dT%H:%M:%S+00:00'


# maximum number of GroupHashes to send down to Snuba,
# if more GroupHash candidates are found, a "bare" Snuba
# search is performed and the result groups are then
# post-filtered via queries to the Sentry DB
MAX_PRE_SNUBA_CANDIDATES = 500

# maximum number of Groups (resulting from a Snuba query)
# to post-filter via a query to the Sentry DB at one time
MAX_POST_SNUBA_CHUNK = 10000


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
            '{}_inclusive'.format(name),
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

        now = timezone.now()
        end = parameters.get('date_to') or (now + ALLOWED_FUTURE_DELTA)
        # TODO: Presumably we want to search back to the project's full retention,
        #       which may be higher than 90 days in the future, but apparently
        #       `retention_window_start` can be None?
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
                        '{} = {}'.format(
                            ds.get_sql_column(Group, 'id'),
                            ds.get_sql_column(GroupEnvironment, 'group_id'),
                        ),
                        '{} = %s'.format(
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

        # pre-filter query
        candidate_hashes = dict(
            GroupHash.objects.filter(
                group__in=group_queryset
            ).values_list(
                'hash', 'group_id'
            )[:MAX_PRE_SNUBA_CANDIDATES + 1]
        )
        metrics.timing('snuba.search.num_candidates', len(candidate_hashes))

        if not candidate_hashes:
            # no matches could possibly be found from this point on
            metrics.incr('snuba.search.no_candidates')
            return Paginator(Group.objects.none()).get_result()
        elif len(candidate_hashes) > MAX_PRE_SNUBA_CANDIDATES:
            # If the pre-filter query didn't include anything to significantly
            # filter down the number of results (from 'first_release', 'query',
            # 'status', 'bookmarked_by', 'assigned_to', 'unassigned',
            # 'subscribed_by', 'active_at_from', or 'active_at_to') then it
            # might have surpassed the MAX_PRE_SNUBA_CANDIDATES. In this case,
            # we *don't* want to pass candidates down to Snuba, and instead we
            # want Snuba to do all the filtering/sorting it can and *then* apply
            # this queryset to the results from Snuba, which we call
            # post-filtering.
            metrics.incr('snuba.search.too_many_candidates')
            candidate_hashes = None

        sort, extra_aggregations, score_fn = sort_strategies[sort_by]

        # {group_id: group_score, ...}
        snuba_groups = snuba_search(
            project_id=project.id,
            environment_id=environment and environment.id,
            tags=tags,
            start=start,
            end=end,
            sort=sort,
            extra_aggregations=extra_aggregations,
            score_fn=score_fn,
            candidate_hashes=candidate_hashes,
            **parameters
        )
        metrics.timing('snuba.search.num_snuba_results', len(snuba_groups))

        if candidate_hashes:
            # pre-filtered candidates were passed down to Snuba,
            # so we're finished with filtering
            result_groups = snuba_groups.items()
        else:
            # pre-filtered candidates were *not* passed down to Snuba,
            # so we need to do post-filtering to verify Sentry DB predicates
            result_groups = []
            i = 0
            for i, chunk in enumerate(chunked(snuba_groups.items(), MAX_POST_SNUBA_CHUNK), 1):
                filtered_group_ids = group_queryset.filter(
                    id__in=[gid for gid, _ in chunk]
                ).values_list('id', flat=True)

                result_groups.extend(
                    (group_id, snuba_groups[group_id])
                    for group_id in filtered_group_ids
                )

            metrics.timing('snuba.search.num_post_filters', i)

        paginator_results = SequencePaginator(
            [(score, id) for (id, score) in result_groups],
            reverse=True,
            **paginator_options
        ).get_result(limit, cursor, count_hits=count_hits)

        groups = Group.objects.in_bulk(paginator_results.results)
        paginator_results.results = [groups[k] for k in paginator_results.results if k in groups]

        return paginator_results


def snuba_search(project_id, environment_id, tags, start, end,
                 sort, extra_aggregations, score_fn, candidate_hashes, **parameters):
    """
    This function doesn't strictly benefit from or require being pulled out of the main
    query method above, but the query method is already large and this function at least
    extracts most of the Snuba-specific logic.

    Returns an OrderedDict of {group_id: group_score, ...} sorted descending by score.
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
        col = 'tags[{}]'.format(tag)
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
    )

    # {hash -> group_id, ...}
    if candidate_hashes is not None:
        # any hash coming back had to come from our candidate set
        hash_to_group = candidate_hashes
    else:
        hash_to_group = dict(
            GroupHash.objects.filter(
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

    return OrderedDict(
        sorted(((gid, score_fn(data))
                for gid, data in group_data.items()), key=lambda t: t[1], reverse=True)
    )
