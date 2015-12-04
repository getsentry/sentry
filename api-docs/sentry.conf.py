# flake8: noqa
from sentry.conf.server import *

import os
import getpass


# for this api docs only.  We
SENTRY_APIDOCS_REDIS_PORT = 12355
SENTRY_APIDOCS_WEB_PORT = 12356
SENTRY_APIDOCS_REDIS_CONF = {
    'host': '127.0.0.1',
    'port': SENTRY_APIDOCS_REDIS_PORT,
}
SENTRY_APIDOCS_REDIS_OPTIONS = {
    'hosts': {
        0: SENTRY_APIDOCS_REDIS_CONF,
        1: SENTRY_APIDOCS_REDIS_CONF,
        2: SENTRY_APIDOCS_REDIS_CONF,
        3: SENTRY_APIDOCS_REDIS_CONF,
    }
}

SENTRY_URL_PREFIX = 'https://app.getsentry.com/'

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

SENTRY_BUFFER_OPTIONS = SENTRY_APIDOCS_REDIS_OPTIONS
SENTRY_CACHE_OPTIONS = SENTRY_APIDOCS_REDIS_OPTIONS
SENTRY_QUOTA_OPTIONS = SENTRY_APIDOCS_REDIS_OPTIONS
SENTRY_RATELIMITER_OPTIONS = SENTRY_APIDOCS_REDIS_OPTIONS
SENTRY_TSDB_OPTIONS = SENTRY_APIDOCS_REDIS_OPTIONS

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

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

EMAIL_HOST = 'localhost'
EMAIL_HOST_PASSWORD = ''
EMAIL_HOST_USER = ''
EMAIL_PORT = 25
EMAIL_USE_TLS = False

SERVER_EMAIL = 'sentry@getsentry.com'

SECRET_KEY = 'super secret secret key'

SENTRY_OPTIONS['system.admin-email'] = 'admin@getsentry.com'
SENTRY_OPTIONS['system.url-prefix'] = SENTRY_URL_PREFIX
