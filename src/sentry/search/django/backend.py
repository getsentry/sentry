"""
sentry.search.django.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import functools
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from sentry import quotas
from sentry.api.event_search import InvalidSearchQuery
from sentry.utils.db import is_postgres


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
        value = search_filter.value.raw_value
        q = self.callback(value)
        if search_filter.operator not in ('=', '!='):
            raise InvalidSearchQuery(
                u'Operator {} not valid for search {}'.format(
                    search_filter.operator,
                    search_filter,
                ),
            )
        queryset_method = queryset.filter if search_filter.operator == '=' else queryset.exclude
        queryset = queryset_method(q)
        return queryset


OPERATOR_TO_DJANGO = {
    '>=': 'gte',
    '<=': 'lte',
    '>': 'gt',
    '<': 'lt',
}


class ScalarCondition(Condition):
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

    def apply(self, queryset, search_filter):
        django_operator = self._get_operator(search_filter)

        qs_method = queryset.exclude if search_filter.operator == '!=' else queryset.filter

        return qs_method(
            **{'{}{}'.format(self.field, django_operator): search_filter.value.raw_value}
        )


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
            'active_at': ScalarCondition('active_at'),
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

        group_queryset = QuerySetBuilder(qs_builder_conditions).build(
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
        return self._query(
            projects, retention_window_start, group_queryset, environments,
            sort_by, limit, cursor, count_hits, paginator_options,
            search_filters, **parameters
        )

    def _query(
        self, projects, retention_window_start, group_queryset, environments,
        sort_by, limit, cursor, count_hits, paginator_options, search_filters,
        **parameters
    ):
        raise NotImplementedError
