# flake8: noqa
from sentry.conf.server import *

import os
import getpass

SENTRY_URL_PREFIX = "https://sentry.io"

# Unsupported here
SENTRY_SINGLE_ORGANIZATION = False


DEBUG = True
CONF_ROOT = os.path.dirname(__file__)

DATABASES = {
    "default": {
        "ENGINE": "sentry.db.postgres",
        "NAME": "sentry_api_docs",
        "USER": "postgres",
        "PASSWORD": "",
        "HOST": "127.0.0.1",
        "PORT": "",
    }
}
SENTRY_USE_BIG_INTS = True

SENTRY_CACHE = "sentry.cache.redis.RedisCache"

CELERY_ALWAYS_EAGER = True

SENTRY_RATELIMITER = "sentry.ratelimits.redis.RedisRateLimiter"
SENTRY_BUFFER = "sentry.buffer.redis.RedisBuffer"
SENTRY_QUOTAS = "sentry.quotas.redis.RedisQuota"
SENTRY_TSDB = "sentry.tsdb.redissnuba.RedisSnubaTSDB"
SENTRY_SEARCH = "sentry.search.snuba.EventsDatasetSnubaSearchBackend"
SENTRY_EVENTSTREAM = "sentry.eventstream.snuba.SnubaEventStream"

LOGIN_REDIRECT_URL = SENTRY_URL_PREFIX + "/"
SENTRY_USE_RELAY = True
SENTRY_WEB_HOST = "127.0.0.1"
SENTRY_APIDOCS_WEB_PORT = SENTRY_WEB_PORT
SENTRY_WEB_OPTIONS = {
    "workers": 1,
    "limit_request_line": 0,
    "secure_scheme_headers": {"X-FORWARDED-PROTO": "https"},
}

SENTRY_OPTIONS.update(
    {
        "system.secret-key": "super secret secret key",
        "system.admin-email": "admin@sentry.io",
        "system.url-prefix": SENTRY_URL_PREFIX,
        "mail.backend": "django.core.mail.backends.smtp.EmailBackend",
        "mail.host": "127.0.0.1",
        "mail.password": "",
        "mail.username": "",
        "mail.port": 25,
        "mail.use-tls": False,
        "mail.from": "sentry@sentry.io",
        "filestore.backend": "filesystem",
        "filestore.options": {"location": "/tmp/sentry-files"},
    }
)

# Enable feature flags so sample responses generate.
SENTRY_FEATURES["projects:servicehooks"] = True
