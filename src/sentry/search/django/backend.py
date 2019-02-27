"""
sentry.search.django.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import functools
from datetime import timedelta

from django.db import router
from django.db.models import Q
from django.utils import timezone

from sentry import quotas, tagstore
from sentry.api.paginator import DateTimePaginator, Paginator, SequencePaginator
from sentry.api.event_search import InvalidSearchQuery
from sentry.search.base import SearchBackend
from sentry.search.django.constants import (
    MSSQL_ENGINES, MSSQL_SORT_CLAUSES, MYSQL_SORT_CLAUSES, ORACLE_SORT_CLAUSES, SORT_CLAUSES,
    SQLITE_SORT_CLAUSES
)
from sentry.utils.dates import to_timestamp
from sentry.utils.db import get_db_engine, is_postgres


class QuerySetBuilder(object):
    """\
    Adds filters to a ``QuerySet`` from a ``parameters`` mapping.

    ``Condition`` objects are registered by their parameter name and used to
    update the ``QuerySet`` instance provided to the ``build`` method if they
    are present in the ``parameters`` mapping.
    """

    def __init__(self, conditions):
        self.conditions = conditions

    def build(self, queryset, parameters):
        for name, condition in self.conditions.items():
            if name in parameters:
                queryset = condition.apply(queryset, name, parameters)
        return queryset


# TODO: Once we've removed the existing `QuerySetBuilder`, rename this to
# QuerySetBuilder
class NewQuerySetBuilder(object):

    def __init__(self, conditions):
        self.conditions = conditions

    def normalize_parameters(self, params):
        """
        Converts passed in parameters into a standard format. Allows us to
        support old/new style parameter being passed in.
        """
        for key, value in params.items():
            yield key, value, None

    def build(self, queryset, parameters):
        for name, value, search_filter in self.normalize_parameters(parameters):
            if name in self.conditions:
                condition = self.conditions[name]
                if isinstance(condition, ScalarCondition):
                    # XXX: Gross temporary hack to support old style
                    # `ScalarCondition`s
                    # This type of `ScalarCondition` should only ever be called
                    # with old style parameters
                    queryset = condition.apply(queryset, name, parameters)
                else:
                    queryset = condition.apply(queryset, value, search_filter)
        return queryset


class SearchFilterQuerySetBuilder(NewQuerySetBuilder):
    def normalize_parameters(self, search_filters):
        for search_filter in search_filters:
            yield (
                search_filter.key.name,
                search_filter.value.raw_value,
                search_filter,
            )


class Condition(object):
    """\
    Adds a single filter to a ``QuerySet`` object. Used with
    ``QuerySetBuilder``.
    """

    def apply(self, queryset, name, parameters):
        raise NotImplementedError


class CallbackCondition(Condition):
    def __init__(self, callback):
        self.callback = callback

    def apply(self, queryset, name, parameters):
        return self.callback(queryset, parameters[name])


class QCallbackCondition(Condition):
    def __init__(self, callback):
        self.callback = callback

    def apply(self, queryset, value, search_filter=None):
        q = self.callback(value)
        # TODO: Once we're entirely using search filters we can just pass them
        # in and not have this check. This is to support the old style search
        # terms.
        if search_filter:
            if search_filter.operator not in ('=', '!='):
                raise InvalidSearchQuery(
                    u'Operator {} not valid for search {}'.format(
                        search_filter.operator,
                        search_filter,
                    ),
                )
            queryset_method = queryset.filter if search_filter.operator == '=' else queryset.exclude
            queryset = queryset_method(q)
        else:
            queryset = queryset.filter(q)
        return queryset


OPERATOR_TO_DJANGO = {
    '>=': 'gte',
    '<=': 'lte',
    '>': 'gt',
    '<': 'lt',
}


# TODO: Rename this to ScalarCondition once we've removed the existing
# `ScalarCondition`
class SearchFilterScalarCondition(Condition):
    """
    Adds a scalar filter to a ``QuerySet`` object. Only accepts `SearchFilter`
    instances
    """

    def __init__(self, field):
        self.field = field

    def _get_operator(self, search_filter):
        django_operator = OPERATOR_TO_DJANGO.get(search_filter.operator, '')
        if django_operator:
            django_operator = '__{}'.format(django_operator)
        return django_operator

    def apply(self, queryset, value, search_filter):
        django_operator = self._get_operator(search_filter)

        qs_method = queryset.exclude if search_filter.operator == '!=' else queryset.filter

        return qs_method(**{'{}{}'.format(self.field, django_operator): value})


class ScalarCondition(Condition):
    """\
    Adds a scalar filter (less than or greater than are supported) to a
    ``QuerySet`` object. Whether or not the filter is inclusive is defined by
    the '{parameter_name}_inclusive' parameter.
    """

    def __init__(self, field, operator, default_inclusivity=True):
        assert operator in ['lt', 'gt']
        self.field = field
        self.operator = operator
        self.default_inclusivity = default_inclusivity

    def apply(self, queryset, name, parameters):
        inclusive = parameters.get(
            u'{}_inclusive'.format(name),
            self.default_inclusivity,
        )
        return queryset.filter(**{
            u'{}__{}{}'.format(
                self.field,
                self.operator,
                'e' if inclusive else ''
            ): parameters[name]
        })


def get_sql_table(model):
    return u'{}'.format(model._meta.db_table)


def get_sql_column(model, field):
    "Convert a model class and field name to it's (unquoted!) SQL column representation."
    return u'{}.{}'.format(*[
        get_sql_table(model),
        model._meta.get_field_by_name(field)[0].column,
    ])


sort_strategies = {
    # sort_by -> Tuple[
    #   Paginator,
    #   String: QuerySet order_by parameter
    # ]
    'priority': (Paginator, '-score'),
    'date': (DateTimePaginator, '-last_seen'),
    'new': (DateTimePaginator, '-first_seen'),
    'freq': (Paginator, '-times_seen'),
}


def get_priority_sort_expression(model):
    engine = get_db_engine(router.db_for_read(model))
    table = get_sql_table(model)
    if 'postgres' in engine:
        return u'log({table}.times_seen) * 600 + {table}.last_seen::abstime::int'.format(table=table)
    else:
        # TODO: This should be improved on other databases where possible.
        # (This doesn't work on some databases: SQLite for example doesn't
        # have a built-in logarithm function.)
        return u'{}.times_seen'.format(table)


environment_sort_strategies = {
    # sort_by -> Tuple[
    #   Function[Model] returning String: SQL expression to generate sort value (of type T, used below),
    #   Function[T] -> int: function for converting sort value to cursor value),
    # ]
    'priority': (
        get_priority_sort_expression,
        int,
    ),
    'date': (
        lambda model: u'{}.last_seen'.format(get_sql_table(model)),
        lambda score: int(to_timestamp(score) * 1000),
    ),
    'new': (
        lambda model: u'{}.first_seen'.format(get_sql_table(model)),
        lambda score: int(to_timestamp(score) * 1000),
    ),
    'freq': (
        lambda model: u'{}.times_seen'.format(get_sql_table(model)),
        int,
    ),
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


def assigned_to_filter(actor, projects):
    from sentry.models import OrganizationMember, OrganizationMemberTeam, Team

    if isinstance(actor, Team):
        return Q(assignee_set__team=actor)

    teams = Team.objects.filter(
        id__in=OrganizationMemberTeam.objects.filter(
            organizationmember__in=OrganizationMember.objects.filter(
                user=actor,
                organization_id=projects[0].organization_id,
            ),
            is_active=True,
        ).values('team')
    )

    return Q(
        Q(assignee_set__user=actor, assignee_set__project__in=projects) |
        Q(assignee_set__team__in=teams)
    )


def unassigned_filter(unassigned, projects):
    from sentry.models.groupassignee import GroupAssignee
    query = Q(
        id__in=GroupAssignee.objects.filter(
            project_id__in=[p.id for p in projects],
        ).values_list('group_id', flat=True),
    )
    if unassigned:
        query = ~query
    return query


def message_regex_filter(queryset, message):
    operator = ('!' if message.operator == '!=' else '') + '~*'

    # XXX: We translate these to a regex like '^<pattern>$'. Since we want to
    # search anywhere in the string, drop those characters.
    message_value = message.value.value[1:-1]

    return queryset.extra(
        where=['message {0} %s OR view {0} %s'.format(operator)],
        params=[message_value, message_value],
    )


class DjangoSearchBackend(SearchBackend):
    def query(self, projects, tags=None, environments=None, sort_by='date', limit=100,
              cursor=None, count_hits=False, paginator_options=None, search_filters=None,
              **parameters):

        from sentry.models import Group, GroupStatus, GroupSubscription

        search_filters = search_filters if search_filters is not None else []

        # ensure projects are from same org
        if len({p.organization_id for p in projects}) != 1:
            raise RuntimeError('Cross organization search not supported')

        if paginator_options is None:
            paginator_options = {}

        if tags is None:
            tags = {}

        group_queryset = Group.objects.filter(project__in=projects).exclude(status__in=[
            GroupStatus.PENDING_DELETION,
            GroupStatus.DELETION_IN_PROGRESS,
            GroupStatus.PENDING_MERGE,
        ])

        qs_builder_conditions = {
            'status': QCallbackCondition(
                lambda status: Q(status=status),
            ),
            'bookmarked_by': QCallbackCondition(
                lambda user: Q(
                    bookmark_set__project__in=projects,
                    bookmark_set__user=user,
                ),
            ),
            'assigned_to': QCallbackCondition(
                functools.partial(assigned_to_filter, projects=projects),
            ),
            'unassigned': QCallbackCondition(
                functools.partial(unassigned_filter, projects=projects),
            ),
            'subscribed_by': QCallbackCondition(
                lambda user: Q(
                    id__in=GroupSubscription.objects.filter(
                        project__in=projects,
                        user=user,
                        is_active=True,
                    ).values_list('group'),
                ),
            ),
            'active_at': SearchFilterScalarCondition('active_at'),
        }

        message = [
            search_filter for search_filter in search_filters
            if search_filter.key.name == 'message'
        ]
        if message and message[0].value.raw_value:
            message = message[0]
            # We only support full wildcard matching in postgres
            if is_postgres() and message.value.is_wildcard():
                group_queryset = message_regex_filter(group_queryset, message)
            else:
                # Otherwise, use the standard LIKE query
                qs_builder_conditions['message'] = QCallbackCondition(
                    lambda message: Q(
                        Q(message__icontains=message) | Q(culprit__icontains=message),
                    ),
                )

        group_queryset = SearchFilterQuerySetBuilder(qs_builder_conditions).build(
            group_queryset,
            search_filters,
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
        return self._query(projects, retention_window_start, group_queryset, tags,
                           environments, sort_by, limit, cursor, count_hits,
                           paginator_options, search_filters, **parameters)

    def _query(self, projects, retention_window_start, group_queryset, tags, environments,
               sort_by, limit, cursor, count_hits, paginator_options, search_filters,
               **parameters):

        from sentry.models import (Group, Event, GroupEnvironment, Release)

        # this backend only supports search within one project/environment
        if len(projects) != 1 or (environments is not None and len(environments) > 1):
            raise NotImplementedError

        project = projects[0]
        environment = environments[0] if environments is not None else environments

        if environment is not None:
            # An explicit environment takes precedence over one defined
            # in the tags data.
            if 'environment' in tags:
                tags.pop('environment')

            event_queryset_builder = QuerySetBuilder({
                'date_from': ScalarCondition('date_added', 'gt'),
                'date_to': ScalarCondition('date_added', 'lt'),
            })

            if any(key in parameters for key in event_queryset_builder.conditions.keys()):
                event_queryset = event_queryset_builder.build(
                    tagstore.get_event_tag_qs(
                        project_id=project.id,
                        environment_id=environment.id,
                        key='environment',
                        value=environment.name,
                    ),
                    parameters,
                )
                if retention_window_start is not None:
                    event_queryset = event_queryset.filter(date_added__gte=retention_window_start)

                group_queryset = group_queryset.filter(
                    id__in=list(event_queryset.distinct().values_list('group_id', flat=True)[:1000])
                )

            _, group_queryset_sort_clause = sort_strategies[sort_by]
            group_queryset = QuerySetBuilder({
                'first_release': CallbackCondition(
                    lambda queryset, version: queryset.extra(
                        where=[
                            '{} = {}'.format(
                                get_sql_column(GroupEnvironment, 'first_release'),
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
                'times_seen': CallbackCondition(
                    # This condition represents the exact number of times that
                    # an issue has been seen in an environment. Since an issue
                    # can't be seen in an environment more times than the issue
                    # was seen overall, we can safely exclude any groups that
                    # don't have at least that many events.
                    lambda queryset, times_seen: queryset.exclude(
                        times_seen__lt=times_seen,
                    ),
                ),
                'times_seen_lower': CallbackCondition(
                    # This condition represents the lower threshold for the
                    # number of times an issue has been seen in an environment.
                    # Since an issue can't be seen in an environment more times
                    # than the issue was seen overall, we can safely exclude
                    # any groups that haven't met that threshold.
                    lambda queryset, times_seen: queryset.exclude(
                        times_seen__lt=times_seen,
                    ),
                ),
                # The following conditions make a few assertions that are are
                # correct in an abstract sense but may not accurately reflect
                # the existing implementation (see GH-5289). These assumptions
                # are that 1. The first seen time for a Group is the minimum
                # value of the first seen time for all of it's GroupEnvironment
                # relations; 2. The last seen time for a Group is the maximum
                # value of the last seen time for all of it's GroupEnvironment
                # relations; 3. The first seen time is always less than or
                # equal to the last seen time.
                'age_from': CallbackCondition(
                    # This condition represents the lower threshold for "first
                    # seen" time for an environment. Due to assertions #1 and
                    # #3, we can exclude any groups where the "last seen" time
                    # is prior to this timestamp.
                    lambda queryset, first_seen: queryset.exclude(
                        last_seen__lt=first_seen,
                    ),
                ),
                'age_to': CallbackCondition(
                    # This condition represents the upper threshold for "first
                    # seen" time for an environment. Due to assertions #1, we
                    # can exclude any values where the group first seen is
                    # greater than that threshold.
                    lambda queryset, first_seen: queryset.exclude(
                        first_seen__gt=first_seen,
                    ),
                ),
                'last_seen_from': CallbackCondition(
                    # This condition represents the lower threshold for "last
                    # seen" time for an environment. Due to assertion #2, we
                    # can exclude any values where the group last seen value is
                    # less than that threshold.
                    lambda queryset, last_seen: queryset.exclude(
                        last_seen__lt=last_seen,
                    ),
                ),
                'last_seen_to': CallbackCondition(
                    # This condition represents the upper threshold for "last
                    # seen" time for an environment. Due to assertions #2 and
                    # #3, we can exclude any values where the group first seen
                    # value is greater than that threshold.
                    lambda queryset, last_seen: queryset.exclude(
                        first_seen__gt=last_seen,
                    ),
                ),
            }).build(
                group_queryset.extra(
                    where=[
                        '{} = {}'.format(
                            get_sql_column(Group, 'id'),
                            get_sql_column(GroupEnvironment, 'group'),
                        ),
                        '{} = %s'.format(
                            get_sql_column(GroupEnvironment, 'environment'),
                        ),
                    ],
                    params=[environment.id],
                    tables=[GroupEnvironment._meta.db_table],
                ),
                parameters,
            ).order_by(group_queryset_sort_clause)

            get_sort_expression, sort_value_to_cursor_value = environment_sort_strategies[sort_by]

            group_tag_value_queryset = tagstore.get_group_tag_value_qs(
                project_id=project.id,
                group_id=set(group_queryset.values_list('id', flat=True)[:10000]),
                environment_id=environment.id,
                key='environment',
                value=environment.name,
            )

            if retention_window_start is not None:
                group_tag_value_queryset = group_tag_value_queryset.filter(
                    last_seen__gte=retention_window_start
                )

            candidates = dict(
                QuerySetBuilder({
                    'age_from': ScalarCondition('first_seen', 'gt'),
                    'age_to': ScalarCondition('first_seen', 'lt'),
                    'last_seen_from': ScalarCondition('last_seen', 'gt'),
                    'last_seen_to': ScalarCondition('last_seen', 'lt'),
                    'times_seen': CallbackCondition(
                        lambda queryset, times_seen: queryset.filter(times_seen=times_seen),
                    ),
                    'times_seen_lower': ScalarCondition('times_seen', 'gt'),
                    'times_seen_upper': ScalarCondition('times_seen', 'lt'),
                }).build(
                    group_tag_value_queryset,
                    parameters,
                ).extra(
                    select={
                        'sort_value': get_sort_expression(group_tag_value_queryset.model),
                    },
                ).values_list('group_id', 'sort_value')
            )

            if tags:
                # TODO: `get_group_ids_for_search_filter` should be able to
                # utilize the retention window start parameter for additional
                # optimizations.
                matches = tagstore.get_group_ids_for_search_filter(
                    project_id=project.id,
                    environment_id=environment.id,
                    tags=tags,
                    candidates=candidates.keys(),
                    limit=len(candidates),
                )
                for key in set(candidates) - set(matches or []):
                    del candidates[key]

            result = SequencePaginator(
                [(sort_value_to_cursor_value(score), id) for (id, score) in candidates.items()],
                reverse=True,
                **paginator_options
            ).get_result(limit, cursor, count_hits=count_hits)

            groups = Group.objects.in_bulk(result.results)
            result.results = [groups[k] for k in result.results if k in groups]

            return result
        else:
            event_queryset_builder = QuerySetBuilder({
                'date_from': ScalarCondition('datetime', 'gt'),
                'date_to': ScalarCondition('datetime', 'lt'),
            })

            if any(key in parameters for key in event_queryset_builder.conditions.keys()):
                group_queryset = group_queryset.filter(
                    id__in=list(
                        event_queryset_builder.build(
                            Event.objects.filter(project_id=project.id),
                            parameters,
                        ).distinct().values_list('group_id', flat=True)[:1000],
                    )
                )

            group_queryset = QuerySetBuilder({
                'first_release': CallbackCondition(
                    lambda queryset, version: queryset.filter(
                        first_release__organization_id=project.organization_id,
                        first_release__version=version,
                    ),
                ),
                'age_from': ScalarCondition('first_seen', 'gt'),
                'age_to': ScalarCondition('first_seen', 'lt'),
                'last_seen_from': ScalarCondition('last_seen', 'gt'),
                'last_seen_to': ScalarCondition('last_seen', 'lt'),
                'times_seen': CallbackCondition(
                    lambda queryset, times_seen: queryset.filter(times_seen=times_seen),
                ),
                'times_seen_lower': ScalarCondition('times_seen', 'gt'),
                'times_seen_upper': ScalarCondition('times_seen', 'lt'),
            }).build(
                group_queryset,
                parameters,
            ).extra(
                select={
                    'sort_value': get_sort_clause(sort_by),
                },
            )

            if tags:
                group_ids = tagstore.get_group_ids_for_search_filter(
                    project_id=project.id,
                    environment_id=None,
                    tags=tags,
                    candidates=None,
                )

                if group_ids:
                    group_queryset = group_queryset.filter(id__in=group_ids)
                else:
                    group_queryset = group_queryset.none()

            paginator_cls, sort_clause = sort_strategies[sort_by]
            group_queryset = group_queryset.order_by(sort_clause)
            paginator = paginator_cls(group_queryset, sort_clause, **paginator_options)
            return paginator.get_result(limit, cursor, count_hits=count_hits)
