"""
sentry.conf.server
~~~~~~~~~~~~~~~~~~

These settings act as the default (base) settings for the Sentry-provided web-server

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.conf.global_settings import *  # NOQA

from datetime import timedelta

import hashlib
import os
import os.path
import socket
import sys
import urlparse


socket.setdefaulttimeout(5)

DEBUG = False
TEMPLATE_DEBUG = True
MAINTENANCE = False

ADMINS = ()

INTERNAL_IPS = ('127.0.0.1',)

MANAGERS = ADMINS

APPEND_SLASH = True

PROJECT_ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), os.pardir))

sys.path.insert(0, os.path.normpath(os.path.join(PROJECT_ROOT, os.pardir)))

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': 'sentry.db',
        'USER': '',
        'PASSWORD': '',
        'HOST': '',
        'PORT': '',
        'AUTOCOMMIT': True,
        'ATOMIC_REQUESTS': False,
    }
}


if 'DATABASE_URL' in os.environ:
    url = urlparse.urlparse(os.environ['DATABASE_URL'])

    # Ensure default database exists.
    DATABASES['default'] = DATABASES.get('default', {})

    # Update with environment configuration.
    DATABASES['default'].update({
        'NAME': url.path[1:],
        'USER': url.username,
        'PASSWORD': url.password,
        'HOST': url.hostname,
        'PORT': url.port,
    })
    if url.scheme == 'postgres':
        DATABASES['default']['ENGINE'] = 'django.db.backends.postgresql_psycopg2'

    if url.scheme == 'mysql':
        DATABASES['default']['ENGINE'] = 'django.db.backends.mysql'

EMAIL_SUBJECT_PREFIX = '[Sentry] '

# Local time zone for this installation. Choices can be found here:
# http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
# although not all choices may be available on all operating systems.
# On Unix systems, a value of None will cause Django to use the same
# timezone as the operating system.
# If running in a Windows environment this must be set to the same as your
# system time zone.
TIME_ZONE = 'UTC'

# Language code for this installation. All choices can be found here:
# http://www.i18nguy.com/unicode/language-identifiers.html
LANGUAGE_CODE = 'en-us'

SITE_ID = 1

# If you set this to False, Django will make some optimizations so as not
# to load the internationalization machinery.
USE_I18N = True

# If you set this to False, Django will not format dates, numbers and
# calendars according to the current locale
USE_L10N = True

USE_TZ = True

# Make this unique, and don't share it with anybody.
SECRET_KEY = hashlib.md5(socket.gethostname() + ')*)&8a36)6%74e@-ne5(-!8a(vv#tkv)(eyg&@0=zd^pl!7=y@').hexdigest()

# List of callables that know how to import templates from various sources.
TEMPLATE_LOADERS = (
    'django.template.loaders.filesystem.Loader',
    'django.template.loaders.app_directories.Loader',
)

MIDDLEWARE_CLASSES = (
    'sentry.middleware.maintenance.ServicesUnavailableMiddleware',
    'sentry.middleware.proxy.SetRemoteAddrFromForwardedFor',
    'sentry.middleware.debug.NoIfModifiedSinceMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'sentry.middleware.sudo.SudoMiddleware',
    'sentry.middleware.locale.SentryLocaleMiddleware',
    'sentry.middleware.social_auth.SentrySocialAuthExceptionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
)

ROOT_URLCONF = 'sentry.conf.urls'

TEMPLATE_DIRS = (
    # Put strings here, like "/home/html/django_templates" or "C:/www/django/templates".
    # Always use forward slashes, even on Windows.
    # Don't forget to use absolute paths, not relative paths.
    os.path.join(PROJECT_ROOT, 'templates'),
)

TEMPLATE_CONTEXT_PROCESSORS = (
    'django.contrib.auth.context_processors.auth',
    'django.contrib.messages.context_processors.messages',
    'django.core.context_processors.csrf',
    'social_auth.context_processors.social_auth_by_name_backends',
    'social_auth.context_processors.social_auth_backends',
    'social_auth.context_processors.social_auth_by_type_backends',
    'social_auth.context_processors.social_auth_login_redirect'
)

INSTALLED_APPS = (
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.messages',
    'django.contrib.sessions',
    'django.contrib.sites',
    'django.contrib.staticfiles',

    'captcha',
    'crispy_forms',
    'djcelery',
    'gunicorn',
    'kombu.transport.django',
    'raven.contrib.django.raven_compat',
    'rest_framework',
    'sentry',
    'sentry.nodestore',
    'sentry.search',
    'sentry.plugins.sentry_interface_types',
    'sentry.plugins.sentry_mail',
    'sentry.plugins.sentry_urls',
    'sentry.plugins.sentry_useragents',
    'social_auth',
    'south',
    'sudo',
)

STATIC_ROOT = os.path.realpath(os.path.join(PROJECT_ROOT, 'static'))
STATIC_URL = '/_static/'

STATICFILES_FINDERS = (
    "django.contrib.staticfiles.finders.FileSystemFinder",
    "django.contrib.staticfiles.finders.AppDirectoriesFinder",
)

# setup a default media root to somewhere useless
MEDIA_ROOT = '/tmp/sentry-media'

LOCALE_PATHS = (
    os.path.join(PROJECT_ROOT, 'locale'),
)

CSRF_FAILURE_VIEW = 'sentry.web.frontend.csrf_failure.view'

# Auth configuration

try:
    from django.core.urlresolvers import reverse_lazy
except ImportError:
    LOGIN_REDIRECT_URL = '/login-redirect/'
    LOGIN_URL = '/login/'
else:
    LOGIN_REDIRECT_URL = reverse_lazy('sentry-login-redirect')
    LOGIN_URL = reverse_lazy('sentry-login')

AUTHENTICATION_BACKENDS = (
    'social_auth.backends.twitter.TwitterBackend',
    'social_auth.backends.facebook.FacebookBackend',
    # TODO: migrate to GoogleOAuth2Backend
    'social_auth.backends.google.GoogleBackend',
    'social_auth.backends.contrib.github.GithubBackend',
    'social_auth.backends.contrib.bitbucket.BitbucketBackend',
    'social_auth.backends.contrib.trello.TrelloBackend',
    'sentry.utils.auth.EmailAuthBackend',
)

SOCIAL_AUTH_USER_MODEL = AUTH_USER_MODEL = 'sentry.User'

SESSION_ENGINE = "django.contrib.sessions.backends.signed_cookies"
SESSION_COOKIE_NAME = "sentrysid"
SESSION_SERIALIZER = "django.contrib.sessions.serializers.PickleSerializer"

TWITTER_CONSUMER_KEY = ''
TWITTER_CONSUMER_SECRET = ''

FACEBOOK_APP_ID = ''
FACEBOOK_API_SECRET = ''
FACEBOOK_EXTENDED_PERMISSIONS = ['email']

GOOGLE_OAUTH2_CLIENT_ID = ''
GOOGLE_OAUTH2_CLIENT_SECRET = ''

GITHUB_APP_ID = ''
GITHUB_API_SECRET = ''

TRELLO_API_KEY = ''
TRELLO_API_SECRET = ''

BITBUCKET_CONSUMER_KEY = ''
BITBUCKET_CONSUMER_SECRET = ''

MAILGUN_API_KEY = ''

SOCIAL_AUTH_PIPELINE = (
    'social_auth.backends.pipeline.user.get_username',
    'social_auth.backends.pipeline.social.social_auth_user',
    'social_auth.backends.pipeline.associate.associate_by_email',
    'social_auth.backends.pipeline.misc.save_status_to_session',
    'sentry.utils.social_auth.create_user_if_enabled',
    'social_auth.backends.pipeline.social.associate_user',
    'social_auth.backends.pipeline.social.load_extra_data',
    'social_auth.backends.pipeline.user.update_user_details',
    'social_auth.backends.pipeline.misc.save_status_to_session',
)

SOCIAL_AUTH_CREATE_USERS = True

INITIAL_CUSTOM_USER_MIGRATION = '0108_fix_user'

# Auth engines and the settings required for them to be listed
AUTH_PROVIDERS = {
    'twitter': ('TWITTER_CONSUMER_KEY', 'TWITTER_CONSUMER_SECRET'),
    'facebook': ('FACEBOOK_APP_ID', 'FACEBOOK_API_SECRET'),
    'github': ('GITHUB_APP_ID', 'GITHUB_API_SECRET'),
    'google': ('GOOGLE_OAUTH2_CLIENT_ID', 'GOOGLE_OAUTH2_CLIENT_SECRET'),
    'trello': ('TRELLO_API_KEY', 'TRELLO_API_SECRET'),
    'bitbucket': ('BITBUCKET_CONSUMER_KEY', 'BITBUCKET_CONSUMER_SECRET'),
}

import random

SOCIAL_AUTH_DEFAULT_USERNAME = lambda: random.choice(['Darth Vader', 'Obi-Wan Kenobi', 'R2-D2', 'C-3PO', 'Yoda'])
SOCIAL_AUTH_PROTECTED_USER_FIELDS = ['email']

# Queue configuration
from kombu import Exchange, Queue

BROKER_URL = "django://"

CELERY_ALWAYS_EAGER = True
CELERY_IGNORE_RESULT = True
CELERY_SEND_EVENTS = False
CELERY_RESULT_BACKEND = None
CELERY_TASK_RESULT_EXPIRES = 1
CELERY_DISABLE_RATE_LIMITS = True
CELERY_DEFAULT_QUEUE = "default"
CELERY_DEFAULT_EXCHANGE = "default"
CELERY_DEFAULT_EXCHANGE_TYPE = "direct"
CELERY_DEFAULT_ROUTING_KEY = "default"
CELERY_CREATE_MISSING_QUEUES = True
CELERY_IMPORTS = (
    'sentry.tasks.check_alerts',
    'sentry.tasks.check_update',
    'sentry.tasks.cleanup',
    'sentry.tasks.deletion',
    'sentry.tasks.email',
    'sentry.tasks.fetch_source',
    'sentry.tasks.index',
    'sentry.tasks.merge',
    'sentry.tasks.store',
    'sentry.tasks.options',
    'sentry.tasks.post_process',
    'sentry.tasks.process_buffer',
)
CELERY_QUEUES = [
    Queue('default', routing_key='default'),
    Queue('alerts', routing_key='alerts'),
    Queue('cleanup', routing_key='cleanup'),
    Queue('sourcemaps', routing_key='sourcemaps'),
    Queue('search', routing_key='search'),
    Queue('events', routing_key='events'),
    Queue('update', routing_key='update'),
    Queue('email', routing_key='email'),
    Queue('options', routing_key='options'),
]

CELERY_ROUTES = ('sentry.queue.routers.SplitQueueRouter',)


def create_partitioned_queues(name):
    exchange = Exchange(name, type='direct')
    for num in range(1):
        CELERY_QUEUES.append(Queue(
            '{0}-{1}'.format(name, num),
            exchange=exchange,
        ))

create_partitioned_queues('counters')
create_partitioned_queues('triggers')


CELERYBEAT_SCHEDULE = {
    'check-alerts': {
        'task': 'sentry.tasks.check_alerts',
        'schedule': timedelta(minutes=1),
        'options': {
            'expires': 60,
            'queue': 'alerts',
        }
    },
    'check-version': {
        'task': 'sentry.tasks.check_update',
        'schedule': timedelta(hours=1),
        'options': {
            'expires': 3600,
        },
    },
    'flush-buffers': {
        'task': 'sentry.tasks.process_buffer.process_pending',
        'schedule': timedelta(seconds=10),
        'options': {
            'expires': 10,
            'queue': 'counters-0',
        }
    },
    'sync-options': {
        'task': 'sentry.tasks.options.sync_options',
        'schedule': timedelta(seconds=10),
        'options': {
            'expires': 10,
            'queue': 'options',
        }
    },
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': True,
    'handlers': {
        'console': {
            'level': 'WARNING',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'sentry': {
            'level': 'ERROR',
            'class': 'raven.contrib.django.handlers.SentryHandler',
        }
    },
    'formatters': {
        'simple': {
            'format': '[%(levelname)s] %(message)s',
        },
        'client_info': {
            'format': '[%(levelname)s] %(project_slug)s/%(team_slug)s %(message)s',
        },
    },
    'root': {
        'handlers': ['console', 'sentry'],
    },
    'loggers': {
        'sentry': {
            'level': 'ERROR',
        },
        'sentry.coreapi': {
            'formatter': 'client_info',
        },
        'sentry.errors': {
            'handlers': ['console'],
            'propagate': False,
        },
        'sentry.rules': {
            'handlers': ['console'],
            'propagate': False,
        },
        'static_compiler': {
            'level': 'INFO',
        },
        'django.request': {
            'level': 'ERROR',
            'handlers': ['console'],
            'propagate': False,
        },
        'toronado.cssutils': {
            'level': 'ERROR',
            'propagate': False,
        },
    }
}

# django-rest-framework

REST_FRAMEWORK = {
    'TEST_REQUEST_DEFAULT_FORMAT': 'json',
}

# django-recaptcha

RECAPTCHA_PUBLIC_KEY = None
RECAPTCHA_PRIVATE_KEY = None

# django-statsd

STATSD_CLIENT = 'django_statsd.clients.null'

# Sentry and Raven configuration

SENTRY_CLIENT = 'sentry.utils.raven.SentryInternalClient'

# Project ID for recording frontend (javascript) exceptions
SENTRY_FRONTEND_PROJECT = None

SENTRY_CACHE_BACKEND = 'default'

SENTRY_FILTERS = (
    'sentry.filters.StatusFilter',
)

SENTRY_IGNORE_EXCEPTIONS = (
    'OperationalError',
)

# Absolute URL to the sentry root directory. Should not include a trailing slash.
SENTRY_URL_PREFIX = ''

# Allow access to Sentry without authentication.
SENTRY_PUBLIC = False

# Login url (defaults to LOGIN_URL)
SENTRY_LOGIN_URL = None

# Default project ID (for internal errors)
SENTRY_PROJECT = 1

# Only store a portion of all messages per unique group.
SENTRY_SAMPLE_DATA = True

# The following values control the sampling rates
SENTRY_SAMPLE_RATES = (
    (50, 1),
    (1000, 2),
    (10000, 10),
    (100000, 50),
    (1000000, 300),
    (10000000, 2000),
)
SENTRY_MAX_SAMPLE_RATE = 10000
SENTRY_SAMPLE_TIMES = (
    (3600, 1),
    (360, 10),
    (60, 60),
)
SENTRY_MAX_SAMPLE_TIME = 10000

# Web Service
SENTRY_WEB_HOST = 'localhost'
SENTRY_WEB_PORT = 9000
SENTRY_WEB_OPTIONS = {
    'workers': 3,
    'limit_request_line': 0,  # required for raven-js
}

# UDP Service
SENTRY_UDP_HOST = 'localhost'
SENTRY_UDP_PORT = 9001
SENTRY_USE_IPV6_UDP = False

# SMTP Service
SENTRY_ENABLE_EMAIL_REPLIES = False
SENTRY_SMTP_HOSTNAME = 'localhost'
SENTRY_SMTP_HOST = 'localhost'
SENTRY_SMTP_PORT = 1025

SENTRY_INTERFACES = {
    'exception': 'sentry.interfaces.exception.Exception',
    'logentry': 'sentry.interfaces.message.Message',
    'request': 'sentry.interfaces.http.Http',
    'stacktrace': 'sentry.interfaces.stacktrace.Stacktrace',
    'template': 'sentry.interfaces.template.Template',
    'query': 'sentry.interfaces.query.Query',
    'user': 'sentry.interfaces.user.User',

    'sentry.interfaces.Exception': 'sentry.interfaces.exception.Exception',
    'sentry.interfaces.Message': 'sentry.interfaces.message.Message',
    'sentry.interfaces.Stacktrace': 'sentry.interfaces.stacktrace.Stacktrace',
    'sentry.interfaces.Template': 'sentry.interfaces.template.Template',
    'sentry.interfaces.Query': 'sentry.interfaces.query.Query',
    'sentry.interfaces.Http': 'sentry.interfaces.http.Http',
    'sentry.interfaces.User': 'sentry.interfaces.user.User',
}

# Should users without superuser permissions be allowed to
# make projects public
SENTRY_ALLOW_PUBLIC_PROJECTS = True

# Should users be allowed to register an account? If this is disabled
# accounts can only be created when someone is invited or added
# manually.
SENTRY_ALLOW_REGISTRATION = True

# Default to not sending the Access-Control-Allow-Origin header on api/store
SENTRY_ALLOW_ORIGIN = None

# Enable scraping of javascript context for source code
SENTRY_SCRAPE_JAVASCRIPT_CONTEXT = True

# Enable email invites
SENTRY_ENABLE_INVITES = True

# Redis connection information (see Nydus documentation)
SENTRY_REDIS_OPTIONS = {}

# Buffer backend
SENTRY_BUFFER = 'sentry.buffer.Buffer'
SENTRY_BUFFER_OPTIONS = {}

# Cache backend
SENTRY_CACHE = 'sentry.cache.django.DjangoCache'
SENTRY_CACHE_OPTIONS = {}

# Quota backend
SENTRY_QUOTAS = 'sentry.quotas.Quota'
SENTRY_QUOTA_OPTIONS = {}

# Rate limiting backend
SENTRY_RATELIMITER = 'sentry.ratelimits.base.RateLimiter'
SENTRY_RATELIMITER_OPTIONS = {}

# The default value for project-level quotas
SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE = '90%'

# The maximum number of events per minute the system should accept.
SENTRY_SYSTEM_MAX_EVENTS_PER_MINUTE = 0

# Node storage backend
SENTRY_NODESTORE = 'sentry.nodestore.django.DjangoNodeStorage'
SENTRY_NODESTORE_OPTIONS = {}

# Search backend
SENTRY_SEARCH = 'sentry.search.django.DjangoSearchBackend'
SENTRY_SEARCH_OPTIONS = {}
# SENTRY_SEARCH_OPTIONS = {
#     'urls': ['http://localhost:9200/'],
#     'timeout': 5,
# }

# Time-series storage backend
SENTRY_TSDB = 'sentry.tsdb.dummy.DummyTSDB'
SENTRY_TSDB_OPTIONS = {}

# rollups must be ordered from highest granularity to lowest
SENTRY_TSDB_ROLLUPS = (
    # (time in seconds, samples to keep)
    (10, 30),  # 5 minute at 10 seconds
    (3600, 24 * 7),  # 7 days at 1 hour
)


# File storage
SENTRY_FILESTORE = 'django.core.files.storage.FileSystemStorage'
SENTRY_FILESTORE_OPTIONS = {'location': '/tmp/sentry-files'}

# URL to embed in js documentation
SENTRY_RAVEN_JS_URL = 'cdn.ravenjs.com/1.1.15/jquery,native/raven.min.js'

# URI Prefixes for generating DSN URLs
# (Defaults to URL_PREFIX by default)
SENTRY_ENDPOINT = None
SENTRY_PUBLIC_ENDPOINT = None

# Early draft features. Not slated or public release yet.
SENTRY_ENABLE_EXPLORE_CODE = False
SENTRY_ENABLE_EXPLORE_USERS = True

# Prevent variables (e.g. context locals, http data, etc) from exceeding this
# size in characters
SENTRY_MAX_VARIABLE_SIZE = 512

# Prevent variables within extra context from exceeding this size in
# characters
SENTRY_MAX_EXTRA_VARIABLE_SIZE = 4096

# For various attributes we don't limit the entire attribute on size, but the
# individual item. In those cases we also want to limit the maximum number of
# keys
SENTRY_MAX_DICTIONARY_ITEMS = 50

SENTRY_MAX_MESSAGE_LENGTH = 1024 * 8
SENTRY_MAX_STACKTRACE_FRAMES = 25
SENTRY_MAX_EXCEPTIONS = 25

# Gravatar service base url
SENTRY_GRAVATAR_BASE_URL = 'https://secure.gravatar.com'

# Timeout (in seconds) for fetching remote source files (e.g. JS)
SENTRY_SOURCE_FETCH_TIMEOUT = 5

# http://en.wikipedia.org/wiki/Reserved_IP_addresses
SENTRY_DISALLOWED_IPS = (
    '0.0.0.0/8',
    '10.0.0.0/8',
    '100.64.0.0/10',
    '127.0.0.0/8',
    '169.254.0.0/16',
    '172.16.0.0/12',
    '192.0.0.0/29',
    '192.0.2.0/24',
    '192.88.99.0/24',
    '192.168.0.0/16',
    '198.18.0.0/15',
    '198.51.100.0/24',
    '224.0.0.0/4',
    '240.0.0.0/4',
    '255.255.255.255/32',
)

# Fields which managed users cannot change via Sentry UI. Username and password
# cannot be changed by managed users. Optionally include 'email' and
# 'first_name' in SENTRY_MANAGED_USER_FIELDS.
SENTRY_MANAGED_USER_FIELDS = ('email',)

# See sentry/options/__init__.py for more information
SENTRY_OPTIONS = {}

# You should not change this setting after your database has been created
# unless you have altered all schemas first
SENTRY_USE_BIG_INTS = False

# Configure celery
import djcelery
djcelery.setup_loader()
