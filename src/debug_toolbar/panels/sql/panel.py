from __future__ import absolute_import, unicode_literals

import uuid
from copy import copy
from collections import defaultdict

from django.conf.urls import url
from django.db import connections
from django.utils.translation import ugettext_lazy as _, ungettext_lazy as __

from debug_toolbar.panels import Panel
from debug_toolbar.panels.sql.forms import SQLSelectForm
from debug_toolbar.utils import render_stacktrace
from debug_toolbar.panels.sql.utils import reformat_sql, contrasting_color_generator
from debug_toolbar.panels.sql.tracking import wrap_cursor, unwrap_cursor
from debug_toolbar.panels.sql import views


def get_isolation_level_display(vendor, level):
    if vendor == 'postgresql':
        import psycopg2.extensions
        choices = {
            psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT: _("Autocommit"),
            psycopg2.extensions.ISOLATION_LEVEL_READ_UNCOMMITTED: _("Read uncommitted"),
            psycopg2.extensions.ISOLATION_LEVEL_READ_COMMITTED: _("Read committed"),
            psycopg2.extensions.ISOLATION_LEVEL_REPEATABLE_READ: _("Repeatable read"),
            psycopg2.extensions.ISOLATION_LEVEL_SERIALIZABLE: _("Serializable"),
        }
    else:
        raise ValueError(vendor)
    return choices.get(level)


def get_transaction_status_display(vendor, level):
    if vendor == 'postgresql':
        import psycopg2.extensions
        choices = {
            psycopg2.extensions.TRANSACTION_STATUS_IDLE: _("Idle"),
            psycopg2.extensions.TRANSACTION_STATUS_ACTIVE: _("Active"),
            psycopg2.extensions.TRANSACTION_STATUS_INTRANS: _("In transaction"),
            psycopg2.extensions.TRANSACTION_STATUS_INERROR: _("In error"),
            psycopg2.extensions.TRANSACTION_STATUS_UNKNOWN: _("Unknown"),
        }
    else:
        raise ValueError(vendor)
    return choices.get(level)


class SQLPanel(Panel):
    """
    Panel that displays information about the SQL queries run while processing
    the request.
    """
    def __init__(self, *args, **kwargs):
        super(SQLPanel, self).__init__(*args, **kwargs)
        self._offset = dict((k, len(connections[k].queries)) for k in connections)
        self._sql_time = 0
        self._num_queries = 0
        self._queries = []
        self._databases = {}
        self._transaction_status = {}
        self._transaction_ids = {}

    def get_transaction_id(self, alias):
        if alias not in connections:
            return
        conn = connections[alias].connection
        if not conn:
            return

        if conn.vendor == 'postgresql':
            cur_status = conn.get_transaction_status()
        else:
            raise ValueError(conn.vendor)

        last_status = self._transaction_status.get(alias)
        self._transaction_status[alias] = cur_status

        if not cur_status:
            # No available state
            return None

        if cur_status != last_status:
            if cur_status:
                self._transaction_ids[alias] = uuid.uuid4().hex
            else:
                self._transaction_ids[alias] = None

        return self._transaction_ids[alias]

    def record(self, alias, **kwargs):
        self._queries.append((alias, kwargs))
        if alias not in self._databases:
            self._databases[alias] = {
                'time_spent': kwargs['duration'],
                'num_queries': 1,
            }
        else:
            self._databases[alias]['time_spent'] += kwargs['duration']
            self._databases[alias]['num_queries'] += 1
        self._sql_time += kwargs['duration']
        self._num_queries += 1

    # Implement the Panel API

    nav_title = _("SQL")

    @property
    def nav_subtitle(self):
        return __("%d query in %.2fms", "%d queries in %.2fms",
                  self._num_queries) % (self._num_queries, self._sql_time)

    @property
    def title(self):
        count = len(self._databases)
        return __('SQL queries from %(count)d connection',
                  'SQL queries from %(count)d connections',
                  count) % {'count': count}

    template = 'debug_toolbar/panels/sql.html'

    @classmethod
    def get_urls(cls):
        return [
            url(r'^sql_select/$', views.sql_select, name='sql_select'),
            url(r'^sql_explain/$', views.sql_explain, name='sql_explain'),
            url(r'^sql_profile/$', views.sql_profile, name='sql_profile'),
        ]

    def enable_instrumentation(self):
        # This is thread-safe because database connections are thread-local.
        for connection in connections.all():
            wrap_cursor(connection, self)

    def disable_instrumentation(self):
        for connection in connections.all():
            unwrap_cursor(connection)

    def process_response(self, request, response):
        colors = contrasting_color_generator()
        trace_colors = defaultdict(lambda: next(colors))
        query_duplicates = defaultdict(lambda: defaultdict(int))
        if self._queries:
            width_ratio_tally = 0
            factor = int(256.0 / (len(self._databases) * 2.5))
            for n, db in enumerate(self._databases.values()):
                rgb = [0, 0, 0]
                color = n % 3
                rgb[color] = 256 - n / 3 * factor
                nn = color
                # XXX: pretty sure this is horrible after so many aliases
                while rgb[color] < factor:
                    nc = min(256 - rgb[color], 256)
                    rgb[color] += nc
                    nn += 1
                    if nn > 2:
                        nn = 0
                    rgb[nn] = nc
                db['rgb_color'] = rgb

            trans_ids = {}
            trans_id = None
            i = 0
            for alias, query in self._queries:
                query_duplicates[alias][query["raw_sql"]] += 1

                trans_id = query.get('trans_id')
                last_trans_id = trans_ids.get(alias)

                if trans_id != last_trans_id:
                    if last_trans_id:
                        self._queries[(i - 1)][1]['ends_trans'] = True
                    trans_ids[alias] = trans_id
                    if trans_id:
                        query['starts_trans'] = True
                if trans_id:
                    query['in_trans'] = True

                query['alias'] = alias
                if 'iso_level' in query:
                    query['iso_level'] = get_isolation_level_display(query['vendor'],
                                                                     query['iso_level'])
                if 'trans_status' in query:
                    query['trans_status'] = get_transaction_status_display(query['vendor'],
                                                                           query['trans_status'])

                query['form'] = SQLSelectForm(auto_id=None, initial=copy(query))

                if query['sql']:
                    query['sql'] = reformat_sql(query['sql'])
                query['rgb_color'] = self._databases[alias]['rgb_color']
                try:
                    query['width_ratio'] = (query['duration'] / self._sql_time) * 100
                    query['width_ratio_relative'] = (
                        100.0 * query['width_ratio'] / (100.0 - width_ratio_tally))
                except ZeroDivisionError:
                    query['width_ratio'] = 0
                    query['width_ratio_relative'] = 0
                query['start_offset'] = width_ratio_tally
                query['end_offset'] = query['width_ratio'] + query['start_offset']
                width_ratio_tally += query['width_ratio']
                query['stacktrace'] = render_stacktrace(query['stacktrace'])
                i += 1

                query['trace_color'] = trace_colors[query['stacktrace']]

            if trans_id:
                self._queries[(i - 1)][1]['ends_trans'] = True

        # Queries are duplicates only if there's as least 2 of them.
        # Also, to hide queries, we need to give all the duplicate groups an id
        query_duplicates = dict(
            (alias, dict(
                (query, duplicate_count)
                for query, duplicate_count in queries.items()
                if duplicate_count >= 2
            ))
            for alias, queries in query_duplicates.items()
        )

        for alias, query in self._queries:
            try:
                duplicates_count = query_duplicates[alias][query["raw_sql"]]
                query["duplicate_count"] = duplicates_count
            except KeyError:
                pass

        for alias, alias_info in self._databases.items():
            try:
                alias_info["duplicate_count"] = sum(e for e in query_duplicates[alias].values())
            except KeyError:
                pass

        self.record_stats({
            'databases': sorted(self._databases.items(), key=lambda x: -x[1]['time_spent']),
            'queries': [q for a, q in self._queries],
            'sql_time': self._sql_time,
        })
