from django.conf import settings
from django.utils.hashcompat import md5_constructor
from django.utils.translation import ugettext_lazy as _

import logging

CATCH_404_ERRORS = getattr(settings, 'SENTRY_CATCH_404_ERRORS', False)

DATABASE_USING = getattr(settings, 'SENTRY_DATABASE_USING', None)

USE_LOGGING = getattr(settings, 'SENTRY_USE_LOGGING', False)

THRASHING_TIMEOUT = getattr(settings, 'SENTRY_THRASHING_TIMEOUT', 60)
THRASHING_LIMIT = getattr(settings, 'SENTRY_THRASHING_LIMIT', 10)

FILTERS = getattr(settings, 'SENTRY_FILTERS', (
    'sentry.filters.StatusFilter',
    'sentry.filters.LoggerFilter',
    'sentry.filters.LevelFilter',
    'sentry.filters.ServerNameFilter',
))

KEY = getattr(settings, 'SENTRY_KEY', md5_constructor(settings.SECRET_KEY).hexdigest())

LOG_LEVELS = (
    (logging.DEBUG, _('debug')),
    (logging.INFO, _('info')),
    (logging.WARNING, _('warning')),
    (logging.ERROR, _('error')),
    (logging.FATAL, _('fatal')),
)

# This should be the full URL to sentries store view
REMOTE_URL = getattr(settings, 'SENTRY_REMOTE_URL', None)

REMOTE_TIMEOUT = getattr(settings, 'SENTRY_REMOTE_TIMEOUT', 5)