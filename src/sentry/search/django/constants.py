"""
sentry.search.django.constants
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import


SORT_CLAUSES = {
    'priority': 'sentry_groupedmessage.score',
    'date': 'EXTRACT(EPOCH FROM sentry_groupedmessage.last_seen)',
    'new': 'EXTRACT(EPOCH FROM sentry_groupedmessage.first_seen)',
    'freq': 'sentry_groupedmessage.times_seen',
    'tottime': 'sentry_groupedmessage.time_spent_total',
    'avgtime': '(sentry_groupedmessage.time_spent_total / sentry_groupedmessage.time_spent_count)',
}
SCORE_CLAUSES = SORT_CLAUSES.copy()

SQLITE_SORT_CLAUSES = SORT_CLAUSES.copy()
SQLITE_SORT_CLAUSES.update({
    'date': "(julianday(sentry_groupedmessage.last_seen) - 2440587.5) * 86400.0",
    'new': "(julianday(sentry_groupedmessage.first_seen) - 2440587.5) * 86400.0",
})
SQLITE_SCORE_CLAUSES = SQLITE_SORT_CLAUSES.copy()

MYSQL_SORT_CLAUSES = SORT_CLAUSES.copy()
MYSQL_SORT_CLAUSES.update({
    'date': 'UNIX_TIMESTAMP(sentry_groupedmessage.last_seen)',
    'new': 'UNIX_TIMESTAMP(sentry_groupedmessage.first_seen)',
})
MYSQL_SCORE_CLAUSES = MYSQL_SORT_CLAUSES.copy()

ORACLE_SORT_CLAUSES = SCORE_CLAUSES.copy()
ORACLE_SORT_CLAUSES.update({
    'date': "(cast(sentry_groupedmessage.last_seen as date)-TO_DATE('01/01/1970 00:00:00', 'MM-DD-YYYY HH24:MI:SS')) * 24 * 60 * 60",
    'new': "(cast(sentry_groupedmessage.first_seen as date)-TO_DATE('01/01/1970 00:00:00', 'MM-DD-YYYY HH24:MI:SS')) * 24 * 60 * 60",
})
ORACLE_SCORE_CLAUSES = ORACLE_SORT_CLAUSES.copy()

MSSQL_SORT_CLAUSES = SCORE_CLAUSES.copy()
MSSQL_SORT_CLAUSES.update({
    'date': "DATEDIFF(s, '1970-01-01T00:00:00', sentry_groupedmessage.last_seen)",
    'new': "DATEDIFF(s, '1970-01-01T00:00:00', sentry_groupedmessage.first_seen)",
})
MSSQL_SCORE_CLAUSES = MSSQL_SORT_CLAUSES.copy()
MSSQL_ENGINES = set(['django_pytds', 'sqlserver_ado', 'sql_server.pyodbc'])
