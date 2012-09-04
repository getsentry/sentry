"""
sentry.conf.defaults
~~~~~~~~~~~~~~~~~~~~

Represents the default values for all Sentry settings.

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import logging
import os
import os.path

MODULE_ROOT = os.path.dirname(__import__('sentry').__file__)

# Allow local testing of Sentry even if DEBUG is enabled
DEBUG = False

FILTERS = (
    'sentry.filters.StatusFilter',
)

KEY = None

LOG_LEVELS = (
    (logging.DEBUG, 'debug'),
    (logging.INFO, 'info'),
    (logging.WARNING, 'warning'),
    (logging.ERROR, 'error'),
    (logging.FATAL, 'fatal'),
)

DEFAULT_LOG_LEVEL = 'error'

DEFAULT_LOGGER_NAME = 'root'

ADMINS = []

# Absolute URL to the sentry root directory. Should not include a trailing slash.
URL_PREFIX = ''

# Allow access to Sentry without authentication.
PUBLIC = False

EMAIL_SUBJECT_PREFIX = ''

INTERNAL_IPS = set()

SERVER_EMAIL = 'root@localhost'

LOGIN_URL = None

PROJECT = 1

# Only store a portion of all messages per unique group.
SAMPLE_DATA = True

# The following values control the sampling rates
SAMPLE_RATES = (
    (50, 1),
    (1000, 2),
    (10000, 10),
    (100000, 50),
    (1000000, 300),
    (10000000, 2000),
)

MAX_SAMPLE_RATE = 10000

SAMPLE_TIMES = (
    (3600, 1),
    (360, 10),
    (60, 60),
)

MAX_SAMPLE_TIME = 10000

# Restrict emails to only ``messages >= this value``.
MAIL_LEVEL = logging.DEBUG

# A list of loggers to restrict emails to.
MAIL_INCLUDE_LOGGERS = None

# A list of loggers to exclude in emails.
MAIL_EXCLUDE_LOGGERS = []

# Normalize counts to the 15 minute marker. This value MUST be less than 60. A
# value of 0 would store counts for every minute, and is the lowest level of
# accuracy provided.
MINUTE_NORMALIZATION = 15

# The number of events to display per page
MESSAGES_PER_PAGE = 15

# Web Service
WEB_HOST = 'localhost'
WEB_PORT = 9000
WEB_OPTIONS = {
    'workers': 3,
}

# UDP Service
UDP_HOST = 'localhost'
UDP_PORT = 9001

# Queue (Kombu)
QUEUE = {
    'transport': 'kombu.transport.django.Transport',
}

# List of event aggregation views
VIEWS = (
    'sentry.views.Exception',
    'sentry.views.Message',
    'sentry.views.Query',
)

# Should users without 'sentry.add_project' permissions be allowed
# to create new projects
ALLOW_PROJECT_CREATION = False

# Should users without 'sentry.add_team' permissions be allowed
# to create new projects
ALLOW_TEAM_CREATION = False

# Should users without superuser permissions be allowed to
# make projects public
ALLOW_PUBLIC_PROJECTS = True

# Instructs Sentry to utilize it's queue for background jobs. You will
# need to ensure that you have workers running if you enable the queue.

# You can also set this to a list of fully qualified job names to only
# selectively enable the queue:
# USE_QUEUE = (
#     'sentry.tasks.store.store_event',
#     'sentry.tasks.cleanup.cleanup',
#     'sentry.tasks.index.index_event',
#     'sentry.tasks.post_process.post_process_group',
#     'sentry.tasks.process_buffer.process_incr',
# )
USE_QUEUE = False

# Instructs Sentry to utilize it's internal search indexer on all incoming
# events..
USE_SEARCH = True

# Default sort option for the group stream
DEFAULT_SORT_OPTION = 'date'

# Default sort option for the search results
SEARCH_DEFAULT_SORT_OPTION = 'date'

# Default project access when a project owner is created
DEFAULT_PROJECT_ACCESS = 'MEMBER_OWNER'

# Default to not sending the Access-Control-Allow-Origin header on api/store
ALLOW_ORIGIN = None

# Enable capturing of JavaScript errors (Sentry internal errors)
USE_JS_CLIENT = False

# The alias for the cache backend (MUST be a compatible backend string for < 1.3)
CACHE_BACKEND = 'dummy://'

# The maximum number of events which can be requested as JSON
MAX_JSON_RESULTS = 1000

# Buffer backend to use
BUFFER = 'sentry.buffer.Buffer'
BUFFER_OPTIONS = {}

# Auth engines and the settings required for them to be listed
AUTH_PROVIDERS = {
    'twitter': ('TWITTER_CONSUMER_KEY', 'TWITTER_CONSUMER_SECRET'),
    'facebook': ('FACEBOOK_APP_ID', 'FACEBOOK_API_SECRET'),
    'github': ('GITHUB_APP_ID', 'GITHUB_API_SECRET'),
    'google': ('GOOGLE_OAUTH2_CLIENT_ID', 'GOOGLE_OAUTH2_CLIENT_SECRET'),
}
