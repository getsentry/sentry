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
from operator import attrgetter
from collections import OrderedDict

from django.conf import settings
from django.utils.translation import ugettext_lazy as _


def get_all_languages():
    results = []
    for path in os.listdir(os.path.join(MODULE_ROOT, 'locale')):
        if path.startswith('.'):
            continue
        if '_' in path:
            pre, post = path.split('_', 1)
            path = '{}-{}'.format(pre, post.lower())
        results.append(path)
    return results

MODULE_ROOT = os.path.dirname(__import__('sentry').__file__)
DATA_ROOT = os.path.join(MODULE_ROOT, 'data')

SORT_OPTIONS = OrderedDict((
    ('priority', _('Priority')),
    ('date', _('Last Seen')),
    ('new', _('First Seen')),
    ('freq', _('Frequency')),
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

# A list of values which represent an unset or empty password on
# a User instance.
EMPTY_PASSWORD_VALUES = ('!', '', '$')

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
DEFAULT_LOGGER_NAME = ''

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
    'exc_type': 'Exception Type',
    'sentry:user': 'User',
    'sentry:filename': 'File',
    'sentry:function': 'Function',
    'sentry:release': 'Release',
    'os': 'OS',
    'url': 'URL',
    'server_name': 'Server',
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
    'sentry.rules.conditions.event_attribute.EventAttributeCondition',
    'sentry.rules.conditions.level.LevelCondition',
)

# methods as defined by http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html + PATCH
HTTP_METHODS = ('GET', 'POST', 'PUT', 'OPTIONS', 'HEAD', 'DELETE', 'TRACE', 'CONNECT', 'PATCH')

CLIENT_RESERVED_ATTRS = (
    'project',
    'errors',
    'event_id',
    'message',
    'checksum',
    'culprit',
    'fingerprint',
    'level',
    'time_spent',
    'logger',
    'server_name',
    'site',
    'received',
    'timestamp',
    'extra',
    'modules',
    'tags',
    'platform',
    'release',
    'environment',
)

DEFAULT_SCRUBBED_FIELDS = (
    'password',
    'secret',
    'passwd',
    'authorization',
    'api_key',
    'apikey',
    'access_token',
)

VALID_PLATFORMS = set([
    'as3',
    'c',
    'cfml',
    'cocoa',
    'csharp',
    'go',
    'java',
    'javascript',
    'node',
    'objc',
    'other',
    'perl',
    'php',
    'python',
    'ruby',
])

OK_PLUGIN_ENABLED = _("The {name} integration has been enabled.")

OK_PLUGIN_DISABLED = _("The {name} integration has been disabled.")

OK_PLUGIN_SAVED = _('Configuration for the {name} integration has been saved.')

# Key to use when ordering a list of events manually
EVENT_ORDERING_KEY = attrgetter('datetime', 'id')

FILTER_MASK = '[Filtered]'
