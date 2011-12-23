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

THRASHING_TIMEOUT = 60
THRASHING_LIMIT = 10

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

# Automatically log frame stacks from all ``logging`` messages.
AUTO_LOG_STACKS = False

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

WEB_HOST = 'localhost'
WEB_PORT = 9000
WEB_LOG_FILE = os.path.join(ROOT, 'sentry.log')
WEB_PID_FILE = os.path.join(ROOT, 'sentry.pid')

MESSAGES_PER_PAGE = 25
