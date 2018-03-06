"""
sentry.search.django.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from collections import defaultdict

from django.db.models import Q

from sentry import tagstore
from sentry.api.paginator import DateTimePaginator, Paginator, SequencePaginator
from sentry.search.base import SearchBackend
from sentry.search.django.constants import (
    MSSQL_ENGINES, MSSQL_SORT_CLAUSES, MYSQL_SORT_CLAUSES, ORACLE_SORT_CLAUSES, SORT_CLAUSES,
    SQLITE_SORT_CLAUSES
)
from sentry.utils.dates import to_timestamp
from sentry.utils.db import get_db_engine


class Condition(object):
    def __init__(self, callback, additional_fields=None):
        self.callback = callback
        self.additional_fields = additional_fields or []

    def apply(self, name, queryset, parameters):
        return self.callback(
            queryset,
            parameters.pop(name),
            *map(parameters.pop, self.additional_fields)
        )


class ScalarCondition(Condition):
    def __init__(self, parameter, field, operator):
        super(ScalarCondition, self).__init__(
            lambda queryset, value, inclusive: queryset.filter(**{
                '{}__{}{}'.format(field, operator, 'e' if inclusive else ''): value,
            }),
            ['{}_inclusive'.format(parameter)],
        )


class QuerySetBuilder(object):
    def __init__(self, conditions):
        self.conditions = conditions

    def build(self, queryset, parameters):
        for name, condition in self.conditions.items():
            if name in parameters:
                queryset = condition.apply(name, queryset, parameters)
        return queryset


def get_sql_column(model, field):
    return '"{}"."{}"'.format(*[
        model._meta.db_table,
        model._meta.get_field_by_name(field)[0].column,
    ])


sort_strategies = defaultdict(lambda: (Paginator, '-sort_value'), {
    'priority': (Paginator, '-score'),
    'date': (DateTimePaginator, '-last_seen'),
    'new': (DateTimePaginator, '-first_seen'),
    'freq': (Paginator, '-times_seen'),
})

environment_sort_strategies = {
    'priority': ('log(times_seen) * 600 + last_seen::abstime::int', int),
    'date': ('last_seen', lambda score: int(to_timestamp(score) * 1000)),
    'new': ('first_seen', lambda score: int(to_timestamp(score) * 1000)),
    'freq': ('times_seen', int),
}


def get_sort_clause(sort_by):
    engine = get_db_engine('default')
    if engine.startswith('sqlite'):
        return SQLITE_SORT_CLAUSES[sort_by]
    elif engine.startswith('mysql'):
        return MYSQL_SORT_CLAUSES[sort_by]
    elif engine.startswith('oracle'):
        return ORACLE_SORT_CLAUSES[sort_by]
    elif engine in MSSQL_ENGINES:
        return MSSQL_SORT_CLAUSES[sort_by]
    else:
        return SORT_CLAUSES[sort_by]


class DjangoSearchBackend(SearchBackend):
    def query(self, project, tags=None, environment=None, sort_by='date', limit=100,
              cursor=None, count_hits=False, paginator_options=None, **parameters):
        from sentry.models import Environment, Group, GroupEnvironment, GroupStatus, GroupSubscription, Release

        if paginator_options is None:
            paginator_options = {}

        if tags is None:
            tags = {}

        group_queryset = QuerySetBuilder({
            'query': Condition(
                lambda queryset, query: queryset.filter(
                    Q(message__icontains=query) | Q(culprit__icontains=query),
                ) if query else queryset,
            ),
            'status': Condition(
                lambda queryset, status: queryset.filter(status=status),
            ),
            'bookmarked_by': Condition(
                lambda queryset, user: queryset.filter(
                    bookmark_set__project=project,
                    bookmark_set__user=user,
                ),
            ),
            'assigned_to': Condition(
                lambda queryset, user: queryset.filter(
                    assignee_set__project=project,
                    assignee_set__user=user,
                ),
            ),
            'unassigned': Condition(
                lambda queryset, unassigned: queryset.filter(
                    assignee_set__isnull=unassigned,
                ),
            ),
            'subscribed_by': Condition(
                lambda queryset, user: queryset.filter(
                    id__in=GroupSubscription.objects.filter(
                        project=project,
                        user=user,
                        is_active=True,
                    ).values_list('group'),
                ),
            ),
            'active_at_from': ScalarCondition('active_at_from', 'active_at', 'gt'),
            'active_at_to': ScalarCondition('active_at_to', 'active_at', 'lt'),
        }).build(
            Group.objects.filter(project=project).exclude(status__in=[
                GroupStatus.PENDING_DELETION,
                GroupStatus.DELETION_IN_PROGRESS,
                GroupStatus.PENDING_MERGE,
            ]),
            parameters,
        )

        if environment is not None:
            if 'environment' in tags:
                # TODO: This should probably just overwrite the existing tag,
                # rather than asserting on it, but...?
                assert Environment.objects.get(
                    projects=project,
                    name=tags.pop('environment'),
                ).id == environment.id

            # TODO: Add additional conditions to the group query that can
            # exclude records that do not meet the constraints we are also
            # going to apply to the group tag value query below. For example,
            # if we require the group to have occurred at least 10 times in
            # environment X, the group itself must have occurred at least 10
            # times.
            group_matches = set(
                QuerySetBuilder({
                    'first_release': Condition(
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
                ).values_list('id', flat=True)  # TODO: Limit?
            )

            sort_expression, sort_value_to_cursor_value = environment_sort_strategies[sort_by]
            candidates = dict(
                QuerySetBuilder({
                    'age_from': ScalarCondition('age_from', 'first_seen', 'gt'),
                    'age_to': ScalarCondition('age_to', 'first_seen', 'lt'),
                    'last_seen_from': ScalarCondition('last_seen_from', 'last_seen', 'gt'),
                    'last_seen_to': ScalarCondition('last_seen_to', 'last_seen', 'lt'),
                    'times_seen': Condition(
                        lambda queryset, times_seen: queryset.filter(times_seen=times_seen),
                    ),
                    'times_seen_lower': ScalarCondition('times_seen_lower', 'times_seen', 'gt'),
                    'times_seen_upper': ScalarCondition('times_seen_upper', 'times_seen', 'lt'),
                }).build(
                    tagstore.get_group_tag_value_qs(
                        project.id,
                        group_matches,
                        environment.id,
                        'environment'
                    ).filter(value=environment.name),
                    parameters,
                ).extra(
                    select={
                        'sort_value': sort_expression,
                    },
                ).values_list('group_id', 'sort_value')
            )

            if tags:
                matches = tagstore.get_group_ids_for_search_filter(
                    project.id,
                    environment.id,
                    tags,
                    candidates.keys(),
                    limit=len(candidates),
                )
                for key in set(candidates) - set(matches):
                    del candidates[key]

            result = SequencePaginator(
                map(
                    lambda (id, score): (sort_value_to_cursor_value(score), id),
                    candidates.items(),
                ),
                reverse=True,
                **paginator_options
            ).get_result(limit, cursor, count_hits=count_hits)

            result.results = filter(
                None,
                map(
                    Group.objects.in_bulk(result.results).get,
                    result.results,
                ),
            )

            return result
        else:
            group_queryset = QuerySetBuilder({
                'first_release': Condition(
                    lambda queryset, version: queryset.filter(
                        first_release__organization_id=project.organization_id,
                        first_release__version=version,
                    ),
                ),
                'age_from': ScalarCondition('age_from', 'first_seen', 'gt'),
                'age_to': ScalarCondition('age_to', 'first_seen', 'lt'),
                'last_seen_from': ScalarCondition('last_seen_from', 'last_seen', 'gt'),
                'last_seen_to': ScalarCondition('last_seen_to', 'last_seen', 'lt'),
                'times_seen': Condition(
                    lambda queryset, times_seen: queryset.filter(times_seen=times_seen),
                ),
                'times_seen_lower': ScalarCondition('times_seen_lower', 'times_seen', 'gt'),
                'times_seen_upper': ScalarCondition('times_seen_upper', 'times_seen', 'lt'),
            }).build(
                group_queryset,
                parameters,
            ).extra(
                select={
                    'sort_value': get_sort_clause(sort_by),
                },
            )

            if tags:
                matches = tagstore.get_group_ids_for_search_filter(project.id, None, tags)
                if matches:
                    group_queryset = group_queryset.filter(id__in=matches)
                else:
                    group_queryset = group_queryset.none()

            paginator_cls, sort_clause = sort_strategies[sort_by]
            group_queryset = group_queryset.order_by(sort_clause)
            paginator = paginator_cls(group_queryset, sort_clause, **paginator_options)
            return paginator.get_result(limit, cursor, count_hits=count_hits)
