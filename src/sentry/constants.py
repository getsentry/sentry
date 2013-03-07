"""
sentry.constants
~~~~~~~~~~~~~~~~

These settings act as the default (base) settings for the Sentry-provided web-server

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.utils.datastructures import SortedDict
from django.utils.translation import ugettext_lazy as _

SORT_OPTIONS = SortedDict((
    ('priority', _('Priority')),
    ('date', _('Last Seen')),
    ('new', _('First Seen')),
    ('freq', _('Frequency')),
    ('tottime', _('Total Time Spent')),
    ('avgtime', _('Average Time Spent')),
    ('accel_15', _('Trending: %(minutes)d minutes' % {'minutes': 15})),
    ('accel_60', _('Trending: %(minutes)d minutes' % {'minutes': 60})),
))

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
    'date': 'sentry_groupedmessage.last_seen',
    'new': 'sentry_groupedmessage.first_seen',
})
SQLITE_SCORE_CLAUSES = SQLITE_SORT_CLAUSES.copy()

MYSQL_SORT_CLAUSES = SORT_CLAUSES.copy()
MYSQL_SORT_CLAUSES.update({
    'date': 'sentry_groupedmessage.last_seen',
    'new': 'sentry_groupedmessage.first_seen',
})
MYSQL_SCORE_CLAUSES = SCORE_CLAUSES.copy()
MYSQL_SCORE_CLAUSES.update({
    'date': 'UNIX_TIMESTAMP(sentry_groupedmessage.last_seen)',
    'new': 'UNIX_TIMESTAMP(sentry_groupedmessage.first_seen)',
})

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

SEARCH_SORT_OPTIONS = SortedDict((
    ('score', _('Score')),
    ('date', _('Last Seen')),
    ('new', _('First Seen')),
))

STATUS_VISIBLE = 0
STATUS_HIDDEN = 1

STATUS_UNRESOLVED = 0
STATUS_RESOLVED = 1
STATUS_MUTED = 2
STATUS_LEVELS = (
    (STATUS_UNRESOLVED, _('Unresolved')),
    (STATUS_RESOLVED, _('Resolved')),
    (STATUS_MUTED, _('Muted')),
)

MEMBER_OWNER = 0
MEMBER_USER = 50
MEMBER_SYSTEM = 100
MEMBER_TYPES = (
    (MEMBER_OWNER, _('Admin')),
    (MEMBER_USER, _('User')),
    (MEMBER_SYSTEM, _('System Agent')),
)

# A list of values which represent an unset or empty password on
# a User instance.
EMPTY_PASSWORD_VALUES = ('!', '', '$')

PLATFORM_LIST = (
    'csharp',
    'connect',
    'django',
    'express',
    'flask',
    'ios',
    'java',
    'javascript',
    'node.js',
    'php',
    'python',
    'r',
    'ruby',
    'rails3',
    'sidekiq',
    'sinatra',
)

PLATFORM_ROOTS = {
    'rails3': 'ruby',
    'sinatra': 'ruby',
    'sidekiq': 'ruby',
    'django': 'python',
    'flask': 'python',
    'express': 'node.js',
    'connect': 'node.js',
}

PLATFORM_TITLES = {
    'rails3': 'Rails 3 (Ruby)',
    'php': 'PHP',
    'ios': 'iOS',
    'express': 'Express (Node.js)',
    'connect': 'Connect (Node.js)',
    'django': 'Django (Python)',
    'flask': 'Flask (Python)',
    'csharp': 'C#',
}

# Normalize counts to the 15 minute marker. This value MUST be less than 60. A
# value of 0 would store counts for every minute, and is the lowest level of
# accuracy provided.
MINUTE_NORMALIZATION = 15
