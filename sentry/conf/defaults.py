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

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), os.pardir))

MODULE_ROOT = os.path.dirname(__import__('sentry').__file__)

# Allow local testing of Sentry even if DEBUG is enabled
DEBUG = False

FILTERS = (
    'sentry.filters.StatusFilter',
    'sentry.filters.LoggerFilter',
    'sentry.filters.LevelFilter',
    'sentry.filters.ServerNameFilter',
    'sentry.filters.SiteFilter',
)

KEY = None

LOG_LEVELS = (
    (logging.DEBUG, 'debug'),
    (logging.INFO, 'info'),
    (logging.WARNING, 'warning'),
    (logging.ERROR, 'error'),
    (logging.FATAL, 'fatal'),
)

ADMINS = []

# Absolute URL to the sentry root directory. Should not include a trailing slash.
URL_PREFIX = ''

# Allow access to Sentry without authentication.
PUBLIC = False

EMAIL_SUBJECT_PREFIX = '[Sentry] '

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

# Instructs Sentry to utilize it's queue for background jobs. You will
# need to ensure that you have workers running if you enable the queue.
USE_QUEUE = False

# Instructs Sentry to utilize it's internal search indexer on all incoming
# events..
USE_SEARCH = True

# Default sort option for the group stream
DEFAULT_SORT_OPTION = 'date'

# Default date cutoff option for the group stream
DEFAULT_DATE_OPTION = '3d'

# Default sort option for the search results
SEARCH_DEFAULT_SORT_OPTION = 'date'

# Default project access when a project owner is created
DEFAULT_PROJECT_ACCESS = 'MEMBER_OWNER'

# Default to not sending the Access-Control-Allow-Origin header on api/store
ALLOW_ORIGIN = None
