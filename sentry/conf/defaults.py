"""
sentry.conf.defaults
~~~~~~~~~~~~~~~~~~~~

Represents the default values for all Sentry settings.

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import logging
import os
import os.path

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), os.pardir))

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

EMAIL_SUBJECT_PREFIX = ''

INTERNAL_IPS = set()

SERVER_EMAIL = 'root@localhost'

LOGIN_URL = None

PROJECT = 1

# Only store a portion of all messages per unique group.
SAMPLE_DATA = True

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

# Directory to stash log files in
LOG_DIR = os.path.join(ROOT, 'log')

# Directory to stash pid files in
RUN_DIR = os.path.join(ROOT, 'run')

# Web Service
WEB_HOST = 'localhost'
WEB_PORT = 9000

# UDP Service
UDP_HOST = 'localhost'
UDP_PORT = 9001

# Queue (Kombu)
QUEUE = {
    'transport': 'djkombu.transport.DatabaseTransport',
}

# List of event handlers
PROCESSORS = (
    'sentry.processors.mail.MailProcessor',
)

# List of event aggregation views
VIEWS = (
    'sentry.views.Exception',
    'sentry.views.Message',
    'sentry.views.Query',
)

# Should users without 'sentry.add_project' permissions be allowed
# to create new projects
ALLOW_PROJECT_CREATION = False
