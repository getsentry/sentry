from __future__ import absolute_import

import six

import pytz
from datetime import timedelta, datetime

from django.utils import timezone

from sentry.api.paginator import SequencePaginator
from sentry.event_manager import ALLOWED_FUTURE_DELTA
from sentry.models import Release, Group, GroupEnvironment, GroupHash
from sentry.search.django.backend import (
    DjangoSearchBackend, QuerySetBuilder, CallbackCondition, get_sql_column
)
from sentry.utils import snuba
from sentry.utils.dates import to_timestamp


datetime_format = '%Y-%m-%dT%H:%M:%S+00:00'


def snuba_to_datetime(d):
    return datetime.strptime(d, datetime_format).replace(tzinfo=pytz.utc)


merge_rules = [
    ('first_seen', min),
    ('last_seen', max),
    ('priority', max),
    ('times_seen', sum)
]


def merge_snuba_results(obj1, obj2):
    new_obj = {}

    for rule in merge_rules:
        field_name, fn = rule
        if field_name in obj1:
            new_obj[field_name] = fn([obj1[field_name], obj2[field_name]])

    return new_obj


convert_rules = [
    ('first_seen', snuba_to_datetime),
    ('last_seen', snuba_to_datetime)
]


def convert_snuba_result(obj):
    for rule in convert_rules:
        field_name, fn = rule
        if field_name in obj:
            obj[field_name] = fn(obj[field_name])

    return obj


sort_strategies = {
    # sort_by -> Tuple[ String: expression to generate sort value (of type T,
    #   used below), Function[T] -> int: function for converting sort value to
    #   cursor value),
    # ]
    # TODO: Are these all really `-`? Where does Django environment search
    # handle sorting (outside of the paginator)?
    'priority': (
        '-priority', int,
    ),
    'date': (
        '-last_seen', lambda score: int(to_timestamp(score) * 1000),
    ),
    'new': (
        '-first_seen', lambda score: int(to_timestamp(score) * 1000),
    ),
    'freq': (
        '-times_seen', int,
    ),
}


class SnubaSearchBackend(DjangoSearchBackend):
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
        start = (parameters.get('date_from')
                 or retention_window_start
                 or (now - timedelta(days=90)))

        # TODO: It's possible `first_release` could be handled by Snuba.
        if environment is not None:
            group_queryset = QuerySetBuilder({
                'first_release': CallbackCondition(
                    lambda queryset, version: queryset.extra(
                        where=[
                            '{} = {}'.format(
                                get_sql_column(GroupEnvironment, 'first_release_id'),
                                get_sql_column(Release, 'id'),
                            ),
                            '{} = %s'.format(
                                get_sql_column(Release, 'organization'),
                            ),
                            '{} = %s'.format(
                                get_sql_column(Release, 'version'),
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
                            get_sql_column(Group, 'id'),
                            get_sql_column(GroupEnvironment, 'group_id'),
                        ),
                        '{} = %s'.format(
                            get_sql_column(GroupEnvironment, 'environment_id'),
                        ),
                    ],
                    params=[environment.id],
                    tables=[GroupEnvironment._meta.db_table],
                ),
                parameters,
            )
        else:
            group_queryset = QuerySetBuilder({
                'first_release': CallbackCondition(
                    lambda queryset, version: queryset.filter(
                        first_release__organization_id=project.organization_id,
                        first_release__version=version,
                    ),
                ),
            }).build(
                group_queryset,
                parameters,
            )

        # TODO: If the query didn't include anything to significantly filter
        # down the number of groups at this point ('first_release', 'query',
        # 'status', 'bookmarked_by', 'assigned_to', 'unassigned',
        # 'subscribed_by', 'active_at_from', or 'active_at_to') then this
        # queryset might return a *huge* number of groups. In this case, we
        # probably *don't* want to pass candidates down to Snuba, and rather we
        # want Snuba to do all the filtering/sorting it can and *then* apply
        # this queryset to the results from Snuba.
        #
        # However, if this did filter down the number of groups siginicantly,
        # then passing in candidates is, of course, valueable.
        #
        # Should we decide which way to handle it based on the number of
        # group_ids, the number of hashes? Or should we just always start the
        # query with Snuba? Something else?
        group_ids = list(group_queryset.values_list('id', flat=True))

        sort_expression, sort_value_to_cursor_value = sort_strategies[sort_by]

        search_results = do_search(
            project_id=project.id,
            environment_id=environment and environment.id,
            tags=tags,
            start=start,
            end=end,
            sort=sort_expression,
            candidates=group_ids,
            **parameters
        )

        paginator_results = SequencePaginator(
            [(sort_value_to_cursor_value(score), id) for (id, score) in search_results.items()],
            reverse=True,
            **paginator_options
        ).get_result(limit, cursor, count_hits=count_hits)

        groups = Group.objects.in_bulk(paginator_results.results)
        paginator_results.results = [groups[k] for k in paginator_results.results if k in groups]

        return paginator_results


def do_search(project_id, environment_id, tags, start, end,
              sort, candidates=None, limit=1000, **parameters):
    from sentry.search.base import ANY

    filters = {
        'project_id': [project_id],
    }

    if environment_id is not None:
        filters['environment'] = [environment_id]

    # TODO:
    # * Snuba needs to filter on:
    #     times_seen: count
    #     date_from/to: window to search, handled by start/end
    #     age_from/to: min timestamp
    #     last_seen_from/to: max timestamp

    if candidates:
        hashes = list(
            GroupHash.objects.filter(
                group_id__in=candidates
            ).values_list(
                'hash', flat=True
            ).distinct()
        )

        if not hashes:
            return []

        filters['primary_hash'] = hashes

    conditions = []
    for tag, val in six.iteritems(tags):
        col = 'tags[{}]'.format(tag)
        if val == ANY:
            conditions.append((col, '!=', ''))
        else:
            conditions.append((col, '=', val))

    aggregations = [
        ['count', '', 'times_seen'],
        ['min', 'timestamp', 'first_seen'],
        ['max', 'timestamp', 'last_seen'],
        ['toUInt32(log(times_seen) * 600) + toUInt32(last_seen)', '', 'priority']
    ]

    snuba_results = snuba.query(
        start=start,
        end=end,
        groupby=['primary_hash'],
        conditions=conditions,
        filter_keys=filters,
        aggregations=aggregations,
        orderby=sort,
        limit=limit,
    )

    for obj in snuba_results.values():
        convert_snuba_result(obj)

    hash_to_group = dict(
        GroupHash.objects.filter(
            project_id=project_id, hash__in=snuba_results.keys()
        ).values_list(
            'hash', 'group_id'
        ).distinct()
    )

    score_field = sort[1:] if sort.startswith('-') else sort

    groups = {}
    for hash, obj in snuba_results.items():
        if hash in hash_to_group:
            group_id = hash_to_group[hash]

            if hash in groups:
                existing_obj = groups[hash]
                obj = merge_snuba_results(obj, existing_obj)

            score = obj[score_field]
            groups[group_id] = score

    return groups
