"""
sentry.search.django.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.db.models import Q

from sentry.api.paginator import Paginator
from sentry.search.base import SearchBackend
from sentry.search.django.constants import (
    SORT_CLAUSES, SQLITE_SORT_CLAUSES, MYSQL_SORT_CLAUSES, MSSQL_SORT_CLAUSES,
    MSSQL_ENGINES, ORACLE_SORT_CLAUSES
)
from sentry.utils.db import get_db_engine


class DjangoSearchBackend(SearchBackend):
    def index(self, event):
        pass

    def query(self, project, query=None, status=None, tags=None,
              bookmarked_by=None, assigned_to=None, sort_by='date',
              date_filter='last_seen', date_from=None, date_to=None,
              cursor=None, limit=100):
        from sentry.models import Group

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

        if status is not None:
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

        if tags:
            for k, v in tags.iteritems():
                queryset = queryset.filter(**dict(
                    grouptag__key=k,
                    grouptag__value=v,
                ))

        if date_filter == 'first_seen':
            if date_from and date_to:
                queryset = queryset.filter(
                    first_seen__gte=date_from,
                    first_seen__lte=date_to,
                )
            elif date_from:
                queryset = queryset.filter(first_seen__gte=date_from)
            elif date_to:
                queryset = queryset.filter(first_seen__lte=date_to)
        elif date_filter == 'last_seen':
            if date_from and date_to:
                queryset = queryset.filter(
                    first_seen__gte=date_from,
                    last_seen__lte=date_to,
                )
            elif date_from:
                queryset = queryset.filter(last_seen__gte=date_from)
            elif date_to:
                queryset = queryset.filter(last_seen__lte=date_to)

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
            queryset = queryset.order_by('-sort_value')
        else:
            queryset = queryset.order_by('-sort_value', '-last_seen')

        paginator = Paginator(queryset, '-sort_value')
        return paginator.get_result(limit, cursor)
