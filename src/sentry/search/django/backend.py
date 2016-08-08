"""
sentry.search.django.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import six

from django.db import router
from django.db.models import Q

from sentry.api.paginator import DateTimePaginator, Paginator
from sentry.search.base import ANY, SearchBackend
from sentry.search.django.constants import (
    SORT_CLAUSES, SQLITE_SORT_CLAUSES, MYSQL_SORT_CLAUSES, MSSQL_SORT_CLAUSES,
    MSSQL_ENGINES, ORACLE_SORT_CLAUSES
)
from sentry.utils.db import get_db_engine


class DjangoSearchBackend(SearchBackend):
    def _tags_to_filter(self, project, tags):
        # Django doesnt support union, so we limit results and try to find
        # reasonable matches
        from sentry.models import GroupTagValue

        # ANY matches should come last since they're the least specific and
        # will provide the largest range of matches
        tag_lookups = sorted(six.iteritems(tags), key=lambda x: x != ANY)

        # get initial matches to start the filter
        matches = None

        # for each remaining tag, find matches contained in our
        # existing set, pruning it down each iteration
        for k, v in tag_lookups:
            if v != ANY:
                base_qs = GroupTagValue.objects.filter(
                    key=k,
                    value=v,
                    project=project,
                )
            else:
                base_qs = GroupTagValue.objects.filter(
                    key=k,
                    project=project,
                ).distinct()

            if matches:
                base_qs = base_qs.filter(group_id__in=matches)

            matches = list(base_qs.values_list('group_id', flat=True)[:1000])
            if not matches:
                return None
        return matches

    def query(self, project, query=None, status=None, tags=None,
              bookmarked_by=None, assigned_to=None, first_release=None,
              sort_by='date', unassigned=None,
              age_from=None, age_from_inclusive=True,
              age_to=None, age_to_inclusive=True,
              date_from=None, date_from_inclusive=True,
              date_to=None, date_to_inclusive=True,
              cursor=None, limit=100):
        from sentry.models import Event, Group, GroupStatus

        engine = get_db_engine('default')

        queryset = Group.objects.filter(project=project)
        if query:
            # TODO(dcramer): if we want to continue to support search on SQL
            # we should at least optimize this in Postgres so that it does
            # the query filter **after** the index filters, and restricts the
            # result set
            queryset = queryset.filter(
                Q(message__icontains=query) |
                Q(culprit__icontains=query)
            )

        if status is None:
            queryset = queryset.exclude(
                status__in=(
                    GroupStatus.PENDING_DELETION,
                    GroupStatus.DELETION_IN_PROGRESS,
                    GroupStatus.PENDING_MERGE,
                )
            )
        else:
            queryset = queryset.filter(status=status)

        if bookmarked_by:
            queryset = queryset.filter(
                bookmark_set__project=project,
                bookmark_set__user=bookmarked_by,
            )

        if assigned_to:
            queryset = queryset.filter(
                assignee_set__project=project,
                assignee_set__user=assigned_to,
            )
        elif unassigned in (True, False):
            queryset = queryset.filter(
                assignee_set__isnull=unassigned,
            )

        if first_release:
            queryset = queryset.filter(
                first_release__project=project,
                first_release__version=first_release,
            )

        if tags:
            matches = self._tags_to_filter(project, tags)
            if matches:
                queryset = queryset.filter(
                    id__in=matches,
                )
            else:
                queryset = queryset.none()

        if age_from or age_to:
            params = {}
            if age_from:
                if age_from_inclusive:
                    params['first_seen__gte'] = age_from
                else:
                    params['first_seen__gt'] = age_from
            if age_to:
                if age_to_inclusive:
                    params['first_seen__lte'] = age_to
                else:
                    params['first_seen__lt'] = age_to
            queryset = queryset.filter(**params)

        if date_from or date_to:
            params = {
                'project_id': project.id,
            }
            if date_from:
                if date_from_inclusive:
                    params['datetime__gte'] = date_from
                else:
                    params['datetime__gt'] = date_from
            if date_to:
                if date_to_inclusive:
                    params['datetime__lte'] = date_to
                else:
                    params['datetime__lt'] = date_to

            event_queryset = Event.objects.filter(**params)
            # limit to the first 1000 results
            group_ids = event_queryset.distinct().values_list(
                'group_id',
                flat=True
            )[:1000]

            # if Event is not on the primary database remove Django's
            # implicit subquery by coercing to a list
            base = router.db_for_read(Group)
            using = router.db_for_read(Event)
            # MySQL also cannot do a LIMIT inside of a subquery
            if base != using or engine.startswith('mysql'):
                group_ids = list(group_ids)

            queryset = queryset.filter(
                id__in=group_ids,
            )

        if engine.startswith('sqlite'):
            score_clause = SQLITE_SORT_CLAUSES[sort_by]
        elif engine.startswith('mysql'):
            score_clause = MYSQL_SORT_CLAUSES[sort_by]
        elif engine.startswith('oracle'):
            score_clause = ORACLE_SORT_CLAUSES[sort_by]
        elif engine in MSSQL_ENGINES:
            score_clause = MSSQL_SORT_CLAUSES[sort_by]
        else:
            score_clause = SORT_CLAUSES[sort_by]

        queryset = queryset.extra(
            select={'sort_value': score_clause},
        )

        # HACK: don't sort by the same column twice
        if sort_by == 'date':
            paginator_cls = DateTimePaginator
            sort_clause = '-last_seen'
        elif sort_by == 'priority':
            paginator_cls = Paginator
            sort_clause = '-score'
        elif sort_by == 'new':
            paginator_cls = DateTimePaginator
            sort_clause = '-first_seen'
        elif sort_by == 'freq':
            paginator_cls = Paginator
            sort_clause = '-times_seen'
        else:
            paginator_cls = Paginator
            sort_clause = '-sort_value'

        queryset = queryset.order_by(sort_clause)

        paginator = paginator_cls(queryset, sort_clause)
        return paginator.get_result(limit, cursor)
