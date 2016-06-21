# flake8: noqa
from sentry.conf.server import *

import os
import getpass


SENTRY_APIDOCS_REDIS_PORT = 12355
SENTRY_APIDOCS_WEB_PORT = 12356

SENTRY_URL_PREFIX = 'https://app.getsentry.com'

# Unsupported here
SENTRY_SINGLE_ORGANIZATION = False


DEBUG = True
CONF_ROOT = os.path.dirname(__file__)

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': '/tmp/sentry_apidocs.db',
    }
}
SENTRY_USE_BIG_INTS = True

SENTRY_CACHE = 'sentry.cache.redis.RedisCache'

CELERY_ALWAYS_EAGER = True
BROKER_URL = 'redis://localhost:%s' % SENTRY_APIDOCS_REDIS_PORT

SENTRY_RATELIMITER = 'sentry.ratelimits.redis.RedisRateLimiter'
SENTRY_BUFFER = 'sentry.buffer.redis.RedisBuffer'
SENTRY_QUOTAS = 'sentry.quotas.redis.RedisQuota'
SENTRY_TSDB = 'sentry.tsdb.redis.RedisTSDB'

SENTRY_FILESTORE = 'django.core.files.storage.FileSystemStorage'
SENTRY_FILESTORE_OPTIONS = {
    'location': '/tmp/sentry-files',
}
LOGIN_REDIRECT_URL = SENTRY_URL_PREFIX + '/'

SENTRY_WEB_HOST = '127.0.0.1'
SENTRY_WEB_PORT = SENTRY_APIDOCS_WEB_PORT
SENTRY_WEB_OPTIONS = {
    'workers': 2,
    'limit_request_line': 0,
    'secure_scheme_headers': {'X-FORWARDED-PROTO': 'https'},
}

SENTRY_OPTIONS.update({
    'redis.clusters': {
        'default': {
            'hosts': {i: {'port': SENTRY_APIDOCS_REDIS_PORT} for i in xrange(0, 4)},
        },
    },
    'system.secret-key': 'super secret secret key',
    'system.admin-email': 'admin@getsentry.com',
    'system.url-prefix': SENTRY_URL_PREFIX,
    'mail.backend': 'django.core.mail.backends.smtp.EmailBackend',
    'mail.host': 'localhost',
    'mail.password': '',
    'mail.username': '',
    'mail.port': 25,
    'mail.use-tls': False,
    'mail.from': 'sentry@getsentry.com',
})
