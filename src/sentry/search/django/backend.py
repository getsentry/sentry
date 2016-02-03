"""
sentry.search.django.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.db.models import Q

from sentry.api.paginator import DateTimePaginator, Paginator
from sentry.search.base import ANY, SearchBackend
from sentry.search.django.constants import (
    SORT_CLAUSES, SQLITE_SORT_CLAUSES, MYSQL_SORT_CLAUSES, MSSQL_SORT_CLAUSES,
    MSSQL_ENGINES, ORACLE_SORT_CLAUSES
)
from sentry.utils.db import get_db_engine


class DjangoSearchBackend(SearchBackend):
    def query(self, project, query=None, status=None, tags=None,
              bookmarked_by=None, assigned_to=None, first_release=None,
              sort_by='date', age_from=None, age_to=None,
              unassigned=None, date_from=None, date_to=None, cursor=None,
              limit=100):
        from sentry.models import Event, Group, GroupStatus

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
            for k, v in tags.iteritems():
                if v == ANY:
                    queryset = queryset.filter(grouptag__key=k)
                else:
                    queryset = queryset.filter(
                        grouptag__key=k,
                        grouptag__value=v,
                    )

        if age_from and age_to:
            queryset = queryset.filter(
                first_seen__gte=age_from,
                first_seen__lte=age_to,
            )
        elif age_from:
            queryset = queryset.filter(first_seen__gte=age_from)
        elif age_to:
            queryset = queryset.filter(first_seen__lte=age_to)

        if date_from or date_to:
            if date_from and date_to:
                event_queryset = Event.objects.filter(
                    project_id=project.id,
                    datetime__gte=date_from,
                    datetime__lte=date_to,
                )
            elif date_from:
                event_queryset = Event.objects.filter(
                    project_id=project.id,
                    datetime__gte=date_from,
                )
            elif date_to:
                event_queryset = Event.objects.filter(
                    project_id=project.id,
                    datetime__lte=date_to,
                )
            # limit to the first 1000 results
            group_ids = event_queryset.distinct().values_list(
                'group_id',
                flat=True
            )[:1000]
            queryset = queryset.filter(
                id__in=group_ids,
            )

        engine = get_db_engine('default')
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

        if sort_by == 'tottime':
            queryset = queryset.filter(time_spent_count__gt=0)
        elif sort_by == 'avgtime':
            queryset = queryset.filter(time_spent_count__gt=0)

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
