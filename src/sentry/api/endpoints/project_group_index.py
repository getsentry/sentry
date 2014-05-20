from datetime import timedelta
from django.http import HttpResponse
from django.utils import timezone

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.constants import (
    SORT_OPTIONS, SORT_CLAUSES, SCORE_CLAUSES,
    MYSQL_SORT_CLAUSES, MYSQL_SCORE_CLAUSES,
    SQLITE_SORT_CLAUSES, SQLITE_SCORE_CLAUSES,
    ORACLE_SORT_CLAUSES, ORACLE_SCORE_CLAUSES,
    MSSQL_SORT_CLAUSES, MSSQL_SCORE_CLAUSES,
    DEFAULT_SORT_OPTION,
)
from sentry.models import TagKey, Group, Project
from sentry.utils.dates import parse_date
from sentry.utils.db import get_db_engine


class ProjectGroupIndexEndpoint(Endpoint):
    # bookmarks=0/1
    # status=<x>
    # <tag>=<value>
    def get(self, request, project_id):
        project = Project.objects.get(
            id=project_id,
        )

        assert_perm(project, request.user, request.auth)

        group_list = Group.objects.all()

        if request.user.is_authenticated() and request.GET.get('bookmarks'):
            group_list = group_list.filter(
                bookmark_set__project=project,
                bookmark_set__user=request.user,
            )
        else:
            group_list = group_list.filter(project=project)

        status = request.GET.get('status')
        if status:
            group_list = group_list.filter(status=int(status))

        tag_keys = TagKey.objects.all_keys(project)
        for tag in tag_keys:
            value = request.GET.get(tag)
            if value:
                group_list = group_list.filter(
                    grouptag__project=project,
                    grouptag__key=tag,
                    grouptag__value=value,
                )

        # TODO: dates should include timestamps
        date_from = request.GET.get('since')
        time_from = request.GET.get('until')
        date_filter = request.GET.get('date_filter')

        date_to = request.GET.get('dt')
        time_to = request.GET.get('tt')

        today = timezone.now()

        # date format is Y-m-d
        if any(x is not None for x in [date_from, time_from, date_to, time_to]):
            date_from, date_to = parse_date(date_from, time_from), parse_date(date_to, time_to)
        else:
            date_from = today - timedelta(days=5)
            date_to = None

        if date_filter == 'first_seen':
            if date_from:
                group_list = group_list.filter(first_seen__gte=date_from)
            elif date_to:
                group_list = group_list.filter(first_seen__lte=date_to)
        else:
            # TODO(dcramer): a date_to no longer makes a lot of sense, and will
            # need corrected when search lands
            if date_from:
                group_list = group_list.filter(last_seen__gte=date_from)
            if date_to:
                group_list = group_list.filter(last_seen__lte=date_to)

        sort = request.GET.get('sort') or request.session.get('streamsort')
        if sort is None:
            sort = DEFAULT_SORT_OPTION
        elif sort not in SORT_OPTIONS or sort.startswith('accel_'):
            return HttpResponse(status=400)

        # Save last sort in session
        if sort != request.session.get('streamsort'):
            request.session['streamsort'] = sort

        engine = get_db_engine('default')
        if engine.startswith('sqlite'):
            score_clause = SQLITE_SORT_CLAUSES.get(sort)
            filter_clause = SQLITE_SCORE_CLAUSES.get(sort)
        elif engine.startswith('mysql'):
            score_clause = MYSQL_SORT_CLAUSES.get(sort)
            filter_clause = MYSQL_SCORE_CLAUSES.get(sort)
        elif engine.startswith('oracle'):
            score_clause = ORACLE_SORT_CLAUSES.get(sort)
            filter_clause = ORACLE_SCORE_CLAUSES.get(sort)
        elif engine in ('django_pytds', 'sqlserver_ado', 'sql_server.pyodbc'):
            score_clause = MSSQL_SORT_CLAUSES.get(sort)
            filter_clause = MSSQL_SCORE_CLAUSES.get(sort)
        else:
            score_clause = SORT_CLAUSES.get(sort)
            filter_clause = SCORE_CLAUSES.get(sort)

        assert score_clause

        if sort == 'tottime':
            group_list = group_list.filter(time_spent_count__gt=0)
        elif sort == 'avgtime':
            group_list = group_list.filter(time_spent_count__gt=0)

        group_list = group_list.extra(
            select={'sort_value': score_clause},
        )

        return self.paginate(
            request=request,
            queryset=group_list,
            order_by='-sort_value',
            on_results=lambda x: serialize(x, request.user),
        )
