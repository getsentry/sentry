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
import six

from collections import OrderedDict, namedtuple
from django.conf import settings
from django.utils.translation import ugettext_lazy as _
from operator import attrgetter

from sentry.utils.integrationdocs import load_doc


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

SORT_OPTIONS = OrderedDict(
    (
        ('priority', _('Priority')), ('date', _('Last Seen')), ('new', _('First Seen')),
        ('freq', _('Frequency')),
    )
)

SEARCH_SORT_OPTIONS = OrderedDict(
    (('score', _('Score')), ('date', _('Last Seen')), ('new', _('First Seen')), )
)

# XXX: Deprecated: use GroupStatus instead
STATUS_UNRESOLVED = 0
STATUS_RESOLVED = 1
STATUS_IGNORED = 2

STATUS_CHOICES = {
    'resolved': STATUS_RESOLVED,
    'unresolved': STATUS_UNRESOLVED,
    'ignored': STATUS_IGNORED,

    # TODO(dcramer): remove in 9.0
    'muted': STATUS_IGNORED,
}

# Normalize counts to the 15 minute marker. This value MUST be less than 60. A
# value of 0 would store counts for every minute, and is the lowest level of
# accuracy provided.
MINUTE_NORMALIZATION = 15

MAX_TAG_KEY_LENGTH = 32
MAX_TAG_VALUE_LENGTH = 200
MAX_CULPRIT_LENGTH = 200
MAX_EMAIL_FIELD_LENGTH = 75

# Team slugs which may not be used. Generally these are top level URL patterns
# which we don't want to worry about conflicts on.
RESERVED_ORGANIZATION_SLUGS = frozenset(
    (
        'admin', 'manage', 'login', 'account', 'register', 'api', 'accept', 'organizations',
        'teams', 'projects', 'help', 'docs', 'logout', '404', '500', '_static', 'out', 'debug',
        'remote', 'get-cli', 'blog', 'welcome', 'features', 'customers', 'integrations', 'signup',
        'pricing', 'subscribe', 'enterprise', 'about', 'jobs', 'thanks', 'guide', 'privacy',
        'security', 'terms', 'from', 'sponsorship', 'for', 'at', 'platforms', 'branding', 'vs',
        'answers', '_admin', 'support', 'contact', 'onboarding', 'ext', 'extension', 'extensions', 'plugins',
    )
)

LOG_LEVELS = {
    logging.NOTSET: 'sample',
    logging.DEBUG: 'debug',
    logging.INFO: 'info',
    logging.WARNING: 'warning',
    logging.ERROR: 'error',
    logging.FATAL: 'fatal',
}
DEFAULT_LOG_LEVEL = 'error'
DEFAULT_LOGGER_NAME = ''
LOG_LEVELS_MAP = {v: k for k, v in six.iteritems(LOG_LEVELS)}

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
    'sentry:dist': 'Distribution',
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
    'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition',
    'sentry.rules.conditions.event_attribute.EventAttributeCondition',
    'sentry.rules.conditions.level.LevelCondition',
)

# methods as defined by http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html + PATCH
HTTP_METHODS = ('GET', 'POST', 'PUT', 'OPTIONS', 'HEAD', 'DELETE', 'TRACE', 'CONNECT', 'PATCH')

CLIENT_RESERVED_ATTRS = (
    'project', 'errors', 'event_id', 'message', 'checksum', 'culprit', 'fingerprint', 'level',
    'time_spent', 'logger', 'server_name', 'site', 'received', 'timestamp', 'extra', 'modules',
    'tags', 'platform', 'release', 'dist', 'environment',
)

# XXX: Must be all lowercase
DEFAULT_SCRUBBED_FIELDS = (
    'password', 'secret', 'passwd', 'api_key', 'apikey', 'access_token', 'auth', 'credentials',
    'mysql_pwd', 'stripetoken', 'card[number]',
)

NOT_SCRUBBED_VALUES = set([
    True,
    False,
    'true',
    'false',
    'null',
    'undefined',
])

VALID_PLATFORMS = set(
    [
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
        'elixir',
        'haskell',
        'groovy',
    ]
)

OK_PLUGIN_ENABLED = _("The {name} integration has been enabled.")

OK_PLUGIN_DISABLED = _("The {name} integration has been disabled.")

OK_PLUGIN_SAVED = _('Configuration for the {name} integration has been saved.')

WARN_SESSION_EXPIRED = 'Your session has expired.'  # TODO: translate this

# Key to use when ordering a list of events manually
EVENT_ORDERING_KEY = attrgetter('datetime', 'id')

FILTER_MASK = '[Filtered]'

# Maximum length of a symbol
MAX_SYM = 256

# Known dsym mimetypes
KNOWN_DSYM_TYPES = {
    'application/x-mach-binary': 'macho',
    'text/x-proguard+plain': 'proguard',
}

NATIVE_UNKNOWN_STRING = '<unknown>'

# to go from an integration id (in _platforms.json) to the platform
# data, such as documentation url or humanized name.
# example: java-logback -> {"type": "framework",
#                           "link": "https://docs.getsentry.com/hosted/clients/java/modules/logback/",
#                           "id": "java-logback",
#                           "name": "Logback"}
INTEGRATION_ID_TO_PLATFORM_DATA = {}


def _load_platform_data():
    INTEGRATION_ID_TO_PLATFORM_DATA.clear()
    data = load_doc('_platforms')

    if not data:
        return

    for platform in data['platforms']:
        integrations = platform.pop('integrations')
        if integrations:
            for integration in integrations:
                integration_id = integration.pop('id')
                if integration['type'] != 'language':
                    integration['language'] = platform['id']
                INTEGRATION_ID_TO_PLATFORM_DATA[integration_id] = integration


_load_platform_data()

# special cases where the marketing slug differs from the integration id
# (in _platforms.json). missing values (for example: "java") should assume
# the marketing slug is the same as the integration id:
# javascript, node, python, php, ruby, go, swift, objc, java, perl, elixir
MARKETING_SLUG_TO_INTEGRATION_ID = {
    "kotlin": "java",
    "scala": "java",
    "android": "java-android",
    "react": "javascript-react",
    "angular": "javascript-angular",
    "angular2": "javascript-angular2",
    "ember": "javascript-ember",
    "backbone": "javascript-backbone",
    "vue": "javascript-vue",
    "express": "node-express",
    "koa": "node-koa",
    "django": "python-django",
    "flask": "python-flask",
    "tornado": "python-tornado",
    "celery": "python-celery",
    "rq": "python-rq",
    "bottle": "python-bottle",
    "pyramid": "python-pyramid",
    "pylons": "python-pylons",
    "laravel": "php-laravel",
    "symfony": "php-symfony2",
    "rails": "ruby-rails",
    "sinatra": "ruby-sinatra",
}


# to go from a marketing page slug like /for/android/ to the integration id
# (in _platforms.json), for looking up documentation urls, etc.
def get_integration_id_for_marketing_slug(slug):
    if slug in MARKETING_SLUG_TO_INTEGRATION_ID:
        return MARKETING_SLUG_TO_INTEGRATION_ID[slug]

    if slug in INTEGRATION_ID_TO_PLATFORM_DATA:
        return slug


# special cases where the integration sent with the SDK differ from
# the integration id (in _platforms.json)
# {PLATFORM: {INTEGRATION_SENT: integration_id, ...}, ...}
PLATFORM_INTEGRATION_TO_INTEGRATION_ID = {
    "java": {
        "java.util.logging": "java-logging",
    },

    # TODO: add more special cases...
}


# to go from event data to the integration id (in _platforms.json),
# for example an event like:
# {"platform": "java",
#  "sdk": {"name": "sentry-java",
#          "integrations": ["java.util.logging"]}} -> java-logging
def get_integration_id_for_event(platform, sdk_name, integrations):
    if integrations:
        for integration in integrations:
            # check special cases
            if platform in PLATFORM_INTEGRATION_TO_INTEGRATION_ID and \
                    integration in PLATFORM_INTEGRATION_TO_INTEGRATION_ID[platform]:
                return PLATFORM_INTEGRATION_TO_INTEGRATION_ID[platform][integration]

            # try <platform>-<integration>, for example "java-log4j"
            integration_id = "%s-%s" % (platform, integration)
            if integration_id in INTEGRATION_ID_TO_PLATFORM_DATA:
                return integration_id

    # try sdk name, for example "sentry-java" -> "java" or "raven-java:log4j" -> "java-log4j"
    sdk_name = sdk_name.lower().replace("sentry-", "").replace("raven-", "").replace(":", "-")
    if sdk_name in INTEGRATION_ID_TO_PLATFORM_DATA:
        return sdk_name

    # try platform name, for example "java"
    if platform in INTEGRATION_ID_TO_PLATFORM_DATA:
        return platform


class ObjectStatus(object):
    VISIBLE = 0
    HIDDEN = 1
    PENDING_DELETION = 2
    DELETION_IN_PROGRESS = 3

    @classmethod
    def as_choices(cls):
        return (
            (cls.VISIBLE, 'visible'), (cls.HIDDEN,
                                       'hidden'), (cls.PENDING_DELETION, 'pending_deletion'),
            (cls.DELETION_IN_PROGRESS, 'deletion_in_progress'),
        )


StatsPeriod = namedtuple('StatsPeriod', ('segments', 'interval'))
