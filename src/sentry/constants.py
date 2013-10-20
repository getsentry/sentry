"""
sentry.constants
~~~~~~~~~~~~~~~~

These settings act as the default (base) settings for the Sentry-provided
web-server

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import logging
import os.path

from django.conf import settings
from django.utils.datastructures import SortedDict
from django.utils.translation import ugettext_lazy as _


def get_all_languages():
    results = []
    for path in os.listdir(os.path.join(MODULE_ROOT, 'locale')):
        if path.startswith('.'):
            continue
        results.append(path)
    return results

MODULE_ROOT = os.path.dirname(__import__('sentry').__file__)
DATA_ROOT = os.path.join(MODULE_ROOT, 'data')

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
    'java_log4j',
    'java_log4j2',
    'java_logback',
    'java_logging',
    'javascript',
    'node.js',
    'php',
    'python',
    'r',
    'ruby',
    'rails3',
    'rails4',
    'sidekiq',
    'sinatra',
    'tornado',
)

PLATFORM_ROOTS = {
    'rails3': 'ruby',
    'rails4': 'ruby',
    'sinatra': 'ruby',
    'sidekiq': 'ruby',
    'django': 'python',
    'flask': 'python',
    'tornado': 'python',
    'express': 'node.js',
    'connect': 'node.js',
    'java_log4j': 'java',
    'java_log4j2': 'java',
    'java_logback': 'java',
    'java_logging': 'java',
}

PLATFORM_TITLES = {
    'rails3': 'Rails 3 (Ruby)',
    'rails4': 'Rails 4 (Ruby)',
    'php': 'PHP',
    'ios': 'iOS',
    'express': 'Express (Node.js)',
    'connect': 'Connect (Node.js)',
    'django': 'Django (Python)',
    'flask': 'Flask (Python)',
    'csharp': 'C#',
    'java_log4j': 'Log4j (Java)',
    'java_log4j2': 'Log4j 2.x (Java)',
    'java_logback': 'Logback (Java)',
    'java_logging': 'java.util.logging',
}

# Normalize counts to the 15 minute marker. This value MUST be less than 60. A
# value of 0 would store counts for every minute, and is the lowest level of
# accuracy provided.
MINUTE_NORMALIZATION = 15

# Prevent variables (e.g. context locals, http data, etc) from exceeding this
# size in characters
MAX_VARIABLE_SIZE = 512

# Prevent varabiesl within extra context from exceeding this size in
# characters
MAX_EXTRA_VARIABLE_SIZE = 2048

# For various attributes we dont limit the entire attribute on size, but the
# individual item. In those cases we also want to limit the maximum number of
# keys
MAX_DICTIONARY_ITEMS = 50

MAX_TAG_KEY_LENGTH = 32
MAX_TAG_VALUE_LENGTH = 200
MAX_CULPRIT_LENGTH = 200
MAX_MESSAGE_LENGTH = 2048

# Team slugs which may not be used. Generally these are top level URL patterns
# which we don't want to worry about conflicts on.
RESERVED_TEAM_SLUGS = (
    'admin', 'manage', 'login', 'account', 'register', 'api',
)

LOG_LEVELS = {
    logging.DEBUG: 'debug',
    logging.INFO: 'info',
    logging.WARNING: 'warning',
    logging.ERROR: 'error',
    logging.FATAL: 'fatal',
}
DEFAULT_LOG_LEVEL = 'error'
DEFAULT_LOGGER_NAME = 'root'

# Default alerting threshold values
DEFAULT_ALERT_PROJECT_THRESHOLD = (500, 100)  # 500%, 100 events
DEFAULT_ALERT_GROUP_THRESHOLD = (1000, 100)  # 1000%, 100 events

# The maximum number of events which can be requested as JSON
MAX_JSON_RESULTS = 1000

# Default paginator value
EVENTS_PER_PAGE = 15

# Default sort option for the group stream
DEFAULT_SORT_OPTION = 'date'

# Default sort option for the search results
SEARCH_DEFAULT_SORT_OPTION = 'date'

# Setup languages for only available locales
LANGUAGE_MAP = dict(settings.LANGUAGES)
LANGUAGES = [(k, LANGUAGE_MAP[k]) for k in get_all_languages() if k in LANGUAGE_MAP]

# Timeout (in seconds) for fetching remote source files (e.g. JS)
SOURCE_FETCH_TIMEOUT = 5
