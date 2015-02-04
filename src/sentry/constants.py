"""
sentry.constants
~~~~~~~~~~~~~~~~

These settings act as the default (base) settings for the Sentry-provided
web-server

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging
import os.path
from collections import OrderedDict

from django.conf import settings
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

SORT_OPTIONS = OrderedDict((
    ('priority', _('Priority')),
    ('date', _('Last Seen')),
    ('new', _('First Seen')),
    ('freq', _('Frequency')),
    ('tottime', _('Total Time Spent')),
    ('avgtime', _('Average Time Spent')),
))

SEARCH_SORT_OPTIONS = OrderedDict((
    ('score', _('Score')),
    ('date', _('Last Seen')),
    ('new', _('First Seen')),
))

# XXX: Deprecated: use GroupStatus instead
STATUS_UNRESOLVED = 0
STATUS_RESOLVED = 1
STATUS_MUTED = 2

STATUS_CHOICES = {
    'resolved': STATUS_RESOLVED,
    'unresolved': STATUS_UNRESOLVED,
    'muted': STATUS_MUTED,
}


MEMBER_OWNER = 0
MEMBER_ADMIN = 25
MEMBER_USER = 50
MEMBER_SYSTEM = 100

MEMBER_TYPES = (
    (MEMBER_OWNER, _('Owner')),
    (MEMBER_ADMIN, _('Admin')),
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
    'go',
    'ios',
    'java',
    'java_log4j',
    'java_log4j2',
    'java_logback',
    'java_logging',
    'javascript',
    'node.js',
    'php',
    'pyramid',
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
    'pyramid': 'python',
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
    'pyramid': 'Pyramid (Python)',
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

MAX_TAG_KEY_LENGTH = 32
MAX_TAG_VALUE_LENGTH = 200
MAX_CULPRIT_LENGTH = 200

# Team slugs which may not be used. Generally these are top level URL patterns
# which we don't want to worry about conflicts on.
RESERVED_ORGANIZATION_SLUGS = (
    'admin', 'manage', 'login', 'account', 'register', 'api',
    'accept', 'organizations', 'teams', 'projects', 'help',
    'docs', 'logout', '404', '500', '_static',
)

RESERVED_TEAM_SLUGS = RESERVED_ORGANIZATION_SLUGS

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
DEFAULT_ALERT_PROJECT_THRESHOLD = (500, 25)  # 500%, 25 events
DEFAULT_ALERT_GROUP_THRESHOLD = (1000, 25)  # 1000%, 25 events

# Default paginator value
EVENTS_PER_PAGE = 15

# Default sort option for the group stream
DEFAULT_SORT_OPTION = 'date'

# Setup languages for only available locales
LANGUAGE_MAP = dict(settings.LANGUAGES)
LANGUAGES = [(k, LANGUAGE_MAP[k]) for k in get_all_languages() if k in LANGUAGE_MAP]

# TODO(dcramer): We eventually want to make this user-editable
TAG_LABELS = {
    'exc_type': _('Exception Type'),
    'sentry:user': _('User'),
    'sentry:filename': _('File'),
    'sentry:function': _('Function'),
    'sentry:release': _('Release'),
    'os': _('OS'),
    'url': _('URL'),
    'server_name': _('Server'),
}

# TODO(dcramer): once this is more flushed out we want this to be extendable
SENTRY_RULES = (
    'sentry.rules.actions.notify_event.NotifyEventAction',
    'sentry.rules.actions.notify_event_service.NotifyEventServiceAction',
    'sentry.rules.conditions.every_event.EveryEventCondition',
    'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
    'sentry.rules.conditions.regression_event.RegressionEventCondition',
    'sentry.rules.conditions.tagged_event.TaggedEventCondition',
    'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
)

# methods as defined by http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html + PATCH
HTTP_METHODS = ('GET', 'POST', 'PUT', 'OPTIONS', 'HEAD', 'DELETE', 'TRACE', 'CONNECT', 'PATCH')
