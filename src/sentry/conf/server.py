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
import tempfile
import urlparse

import sentry

gettext_noop = lambda s: s

socket.setdefaulttimeout(5)

DEBUG = False
TEMPLATE_DEBUG = True
MAINTENANCE = False

ADMINS = ()

INTERNAL_IPS = ()

MANAGERS = ADMINS

APPEND_SLASH = True

PROJECT_ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), os.pardir))

# XXX(dcramer): handle case when we've installed from source vs just running
# this straight out of the repository
if 'site-packages' in __file__:
    NODE_MODULES_ROOT = os.path.join(PROJECT_ROOT, 'node_modules')
else:
    NODE_MODULES_ROOT = os.path.join(PROJECT_ROOT, os.pardir, os.pardir, 'node_modules')

NODE_MODULES_ROOT = os.path.normpath(NODE_MODULES_ROOT)

sys.path.insert(0, os.path.normpath(os.path.join(PROJECT_ROOT, os.pardir)))

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
        DATABASES['default']['ENGINE'] = 'sentry.db.postgres'

    if url.scheme == 'mysql':
        DATABASES['default']['ENGINE'] = 'django.db.backends.mysql'

# This should always be UTC.
TIME_ZONE = 'UTC'

# Language code for this installation. All choices can be found here:
# http://www.i18nguy.com/unicode/language-identifiers.html
LANGUAGE_CODE = 'en-us'

LANGUAGES = (
    ('af', gettext_noop('Afrikaans')),
    ('ar', gettext_noop('Arabic')),
    ('az', gettext_noop('Azerbaijani')),
    ('bg', gettext_noop('Bulgarian')),
    ('be', gettext_noop('Belarusian')),
    ('bn', gettext_noop('Bengali')),
    ('br', gettext_noop('Breton')),
    ('bs', gettext_noop('Bosnian')),
    ('ca', gettext_noop('Catalan')),
    ('cs', gettext_noop('Czech')),
    ('cy', gettext_noop('Welsh')),
    ('da', gettext_noop('Danish')),
    ('de', gettext_noop('German')),
    ('el', gettext_noop('Greek')),
    ('en', gettext_noop('English')),
    ('eo', gettext_noop('Esperanto')),
    ('es', gettext_noop('Spanish')),
    ('et', gettext_noop('Estonian')),
    ('eu', gettext_noop('Basque')),
    ('fa', gettext_noop('Persian')),
    ('fi', gettext_noop('Finnish')),
    ('fr', gettext_noop('French')),
    ('ga', gettext_noop('Irish')),
    ('gl', gettext_noop('Galician')),
    ('he', gettext_noop('Hebrew')),
    ('hi', gettext_noop('Hindi')),
    ('hr', gettext_noop('Croatian')),
    ('hu', gettext_noop('Hungarian')),
    ('ia', gettext_noop('Interlingua')),
    ('id', gettext_noop('Indonesian')),
    ('is', gettext_noop('Icelandic')),
    ('it', gettext_noop('Italian')),
    ('ja', gettext_noop('Japanese')),
    ('ka', gettext_noop('Georgian')),
    ('kk', gettext_noop('Kazakh')),
    ('km', gettext_noop('Khmer')),
    ('kn', gettext_noop('Kannada')),
    ('ko', gettext_noop('Korean')),
    ('lb', gettext_noop('Luxembourgish')),
    ('lt', gettext_noop('Lithuanian')),
    ('lv', gettext_noop('Latvian')),
    ('mk', gettext_noop('Macedonian')),
    ('ml', gettext_noop('Malayalam')),
    ('mn', gettext_noop('Mongolian')),
    ('my', gettext_noop('Burmese')),
    ('nb', gettext_noop('Norwegian Bokmal')),
    ('ne', gettext_noop('Nepali')),
    ('nl', gettext_noop('Dutch')),
    ('nn', gettext_noop('Norwegian Nynorsk')),
    ('os', gettext_noop('Ossetic')),
    ('pa', gettext_noop('Punjabi')),
    ('pl', gettext_noop('Polish')),
    ('pt', gettext_noop('Portuguese')),
    ('pt-br', gettext_noop('Brazilian Portuguese')),
    ('ro', gettext_noop('Romanian')),
    ('ru', gettext_noop('Russian')),
    ('sk', gettext_noop('Slovak')),
    ('sl', gettext_noop('Slovenian')),
    ('sq', gettext_noop('Albanian')),
    ('sr', gettext_noop('Serbian')),
    ('sv-se', gettext_noop('Swedish')),
    ('sw', gettext_noop('Swahili')),
    ('ta', gettext_noop('Tamil')),
    ('te', gettext_noop('Telugu')),
    ('th', gettext_noop('Thai')),
    ('tr', gettext_noop('Turkish')),
    ('tt', gettext_noop('Tatar')),
    ('udm', gettext_noop('Udmurt')),
    ('uk', gettext_noop('Ukrainian')),
    ('ur', gettext_noop('Urdu')),
    ('vi', gettext_noop('Vietnamese')),
    ('zh-cn', gettext_noop('Simplified Chinese')),
    ('zh-tw', gettext_noop('Traditional Chinese')),
)

from .locale import CATALOGS
LANGUAGES = tuple((code, name) for code, name in LANGUAGES
                  if code in CATALOGS)

SUPPORTED_LANGUAGES = frozenset(CATALOGS)

SITE_ID = 1

# If you set this to False, Django will make some optimizations so as not
# to load the internationalization machinery.
USE_I18N = True

# If you set this to False, Django will not format dates, numbers and
# calendars according to the current locale
USE_L10N = True

USE_TZ = True


# List of callables that know how to import templates from various sources.
TEMPLATE_LOADERS = (
    'django.template.loaders.filesystem.Loader',
    'django.template.loaders.app_directories.Loader',
)

MIDDLEWARE_CLASSES = (
    'sentry.middleware.proxy.ContentLengthHeaderMiddleware',
    'sentry.middleware.maintenance.ServicesUnavailableMiddleware',
    'sentry.middleware.env.SentryEnvMiddleware',
    'sentry.middleware.proxy.SetRemoteAddrFromForwardedFor',
    'sentry.middleware.debug.NoIfModifiedSinceMiddleware',
    'sentry.middleware.stats.RequestTimingMiddleware',
    'sentry.middleware.stats.ResponseCodeMiddleware',
    'sentry.middleware.health.HealthCheck',  # Must exist before CommonMiddleware
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'sentry.middleware.auth.AuthenticationMiddleware',
    'sentry.middleware.sudo.SudoMiddleware',
    'sentry.middleware.superuser.SuperuserMiddleware',
    'sentry.middleware.locale.SentryLocaleMiddleware',
    'sentry.middleware.social_auth.SentrySocialAuthExceptionMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'sentry.debug.middleware.DebugMiddleware',
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
    'django.core.context_processors.request',
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
    'debug_toolbar',
    'raven.contrib.django.raven_compat',
    'rest_framework',
    'sentry',
    'sentry.nodestore',
    'sentry.search',
    'sentry.lang.javascript',
    'sentry.lang.native',
    'sentry.plugins.sentry_interface_types',
    'sentry.plugins.sentry_mail',
    'sentry.plugins.sentry_urls',
    'sentry.plugins.sentry_useragents',
    'sentry.plugins.sentry_webhooks',
    'social_auth',
    'south',
    'sudo',
)

STATIC_ROOT = os.path.realpath(os.path.join(PROJECT_ROOT, 'static'))
STATIC_URL = '/_static/{version}/'

STATICFILES_FINDERS = (
    "django.contrib.staticfiles.finders.FileSystemFinder",
    "django.contrib.staticfiles.finders.AppDirectoriesFinder",
)

ASSET_VERSION = 0

# setup a default media root to somewhere useless
MEDIA_ROOT = '/tmp/sentry-media'

LOCALE_PATHS = (
    os.path.join(PROJECT_ROOT, 'locale'),
)

CSRF_FAILURE_VIEW = 'sentry.web.frontend.csrf_failure.view'
CSRF_COOKIE_NAME = 'csrf'

# Auth configuration

try:
    from django.core.urlresolvers import reverse_lazy
except ImportError:
    LOGIN_REDIRECT_URL = '/login-redirect/'
    LOGIN_URL = '/auth/login/'
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

SOCIAL_AUTH_PIPELINE = (
    'social_auth.backends.pipeline.user.get_username',
    'social_auth.backends.pipeline.social.social_auth_user',
    'social_auth.backends.pipeline.associate.associate_by_email',
    'social_auth.backends.pipeline.misc.save_status_to_session',
    'social_auth.backends.pipeline.social.associate_user',
    'social_auth.backends.pipeline.social.load_extra_data',
    'social_auth.backends.pipeline.user.update_user_details',
    'social_auth.backends.pipeline.misc.save_status_to_session',
)

INITIAL_CUSTOM_USER_MIGRATION = '0108_fix_user'

# Auth engines and the settings required for them to be listed
AUTH_PROVIDERS = {
    'github': ('GITHUB_APP_ID', 'GITHUB_API_SECRET'),
    'trello': ('TRELLO_API_KEY', 'TRELLO_API_SECRET'),
    'bitbucket': ('BITBUCKET_CONSUMER_KEY', 'BITBUCKET_CONSUMER_SECRET'),
}

import random

SOCIAL_AUTH_DEFAULT_USERNAME = lambda: random.choice(['Darth Vader', 'Obi-Wan Kenobi', 'R2-D2', 'C-3PO', 'Yoda'])
SOCIAL_AUTH_PROTECTED_USER_FIELDS = ['email']

# Queue configuration
from kombu import Exchange, Queue

BROKER_URL = "django://"
BROKER_TRANSPORT_OPTIONS = {}

# Ensure workers run async by default
# in Development you might want them to run in-process
# though it would cause timeouts/recursions in some cases
CELERY_ALWAYS_EAGER = False

CELERY_EAGER_PROPAGATES_EXCEPTIONS = True
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
    'sentry.tasks.auth',
    'sentry.tasks.beacon',
    'sentry.tasks.clear_expired_snoozes',
    'sentry.tasks.check_auth',
    'sentry.tasks.deletion',
    'sentry.tasks.digests',
    'sentry.tasks.dsymcache',
    'sentry.tasks.email',
    'sentry.tasks.merge',
    'sentry.tasks.store',
    'sentry.tasks.options',
    'sentry.tasks.ping',
    'sentry.tasks.post_process',
    'sentry.tasks.process_buffer',
)
CELERY_QUEUES = [
    Queue('default', routing_key='default'),
    Queue('alerts', routing_key='alerts'),
    Queue('auth', routing_key='auth'),
    Queue('cleanup', routing_key='cleanup'),
    Queue('merge', routing_key='merge'),
    Queue('search', routing_key='search'),
    Queue('events', routing_key='events'),
    Queue('update', routing_key='update'),
    Queue('email', routing_key='email'),
    Queue('options', routing_key='options'),
    Queue('digests.delivery', routing_key='digests.delivery'),
    Queue('digests.scheduling', routing_key='digests.scheduling'),
]

for queue in CELERY_QUEUES:
    queue.durable = False

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

CELERYBEAT_SCHEDULE_FILENAME = os.path.join(tempfile.gettempdir(), 'sentry-celerybeat')
CELERYBEAT_SCHEDULE = {
    'check-auth': {
        'task': 'sentry.tasks.check_auth',
        'schedule': timedelta(minutes=1),
        'options': {
            'expires': 60,
            'queue': 'auth',
        }
    },
    'send-beacon': {
        'task': 'sentry.tasks.send_beacon',
        'schedule': timedelta(hours=1),
        'options': {
            'expires': 3600,
        },
    },
    'send-ping': {
        'task': 'sentry.tasks.send_ping',
        'schedule': timedelta(minutes=1),
        'options': {
            'expires': 60,
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
    'schedule-digests': {
        'task': 'sentry.tasks.digests.schedule_digests',
        'schedule': timedelta(seconds=30),
        'options': {
            'expires': 30,
        },
    },
    'clear-expired-snoozes': {
        'task': 'sentry.tasks.clear_expired_snoozes',
        'schedule': timedelta(minutes=5),
        'options': {
            'expires': 300,
        },
    },
    # Disabled for the time being:
    # 'clear-old-cached-dsyms': {
    #     'task': 'sentry.tasks.clear_old_cached_dsyms',
    #     'schedule': timedelta(minutes=60),
    #     'options': {
    #         'expires': 3600,
    #     },
    # },
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': True,
    'handlers': {
        'null': {
            'class': 'django.utils.log.NullHandler',
        },
        'console': {
            'level': 'WARNING',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'sentry': {
            'level': 'ERROR',
            'filters': ['sentry:internal'],
            'class': 'raven.contrib.django.handlers.SentryHandler',
        },
        'audit': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'console:api': {
            'level': 'WARNING',
            'class': 'logging.StreamHandler',
            'formatter': 'client_info',
        },
    },
    'filters': {
        'sentry:internal': {
            '()': 'sentry.utils.raven.SentryInternalFilter',
        },
    },
    'formatters': {
        'simple': {
            'format': '[%(levelname)s] %(message)s',
        },
        'client_info': {
            'format': '[%(levelname)s] [%(project)s] [%(agent)s] %(message)s',
        },
    },
    'root': {
        'handlers': ['console', 'sentry'],
    },
    'loggers': {
        'sentry': {
            'level': 'ERROR',
        },
        'sentry.auth': {
            'handlers': ['audit'],
        },
        'sentry.api': {
            'handlers': ['console:api', 'sentry'],
            'propagate': False,
        },
        'sentry.deletions': {
            'handlers': ['audit'],
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
            'handlers': ['null'],
            'propagate': False,
        },
    }
}

# django-rest-framework

REST_FRAMEWORK = {
    'TEST_REQUEST_DEFAULT_FORMAT': 'json',
    'DEFAULT_PERMISSION_CLASSES': (
        'sentry.api.permissions.NoPermission',
    ),
}

CRISPY_TEMPLATE_PACK = 'bootstrap3'

# django-recaptcha

RECAPTCHA_PUBLIC_KEY = None
RECAPTCHA_PRIVATE_KEY = None
NOCAPTCHA = True

CAPTCHA_WIDGET_TEMPLATE = "sentry/partial/form_captcha.html"

# Debugger

DEBUG_TOOLBAR_PANELS = (
    'debug_toolbar.panels.timer.TimerPanel',
    'sentry.debug.panels.route.RoutePanel',
    'debug_toolbar.panels.templates.TemplatesPanel',

    'debug_toolbar.panels.sql.SQLPanel',
    # TODO(dcramer): https://github.com/getsentry/sentry/issues/1722
    # 'sentry.debug.panels.redis.RedisPanel',
)

DEBUG_TOOLBAR_PATCH_SETTINGS = False

# Sentry and Raven configuration

SENTRY_CLIENT = 'sentry.utils.raven.SentryInternalClient'

SENTRY_FEATURES = {
    'auth:register': True,
    'organizations:create': True,
    'organizations:sso': True,
    'organizations:callsigns': False,
    'projects:global-events': False,
    'projects:quotas': True,
    'projects:plugins': True,
    'projects:dsym': False,
}

# Default time zone for localization in the UI.
# http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
SENTRY_DEFAULT_TIME_ZONE = 'UTC'

# Enable the Sentry Debugger (Beta)
SENTRY_DEBUGGER = False

SENTRY_IGNORE_EXCEPTIONS = (
    'OperationalError',
)

# Should we send the beacon to the upstream server?
SENTRY_BEACON = True

# Allow access to Sentry without authentication.
SENTRY_PUBLIC = False

# Instruct Sentry that this install intends to be run by a single organization
# and thus various UI optimizations should be enabled.
SENTRY_SINGLE_ORGANIZATION = False

# Login url (defaults to LOGIN_URL)
SENTRY_LOGIN_URL = None

# Default project ID (for internal errors)
SENTRY_PROJECT = 1

# Project ID for recording frontend (javascript) exceptions
SENTRY_FRONTEND_PROJECT = None

# Only store a portion of all messages per unique group.
SENTRY_SAMPLE_DATA = True

# The following values control the sampling rates
SENTRY_SAMPLE_RATES = (
    # up until N events, store 1 in M
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
SENTRY_WEB_OPTIONS = {}

# SMTP Service
SENTRY_SMTP_HOST = 'localhost'
SENTRY_SMTP_PORT = 1025

SENTRY_INTERFACES = {
    'csp': 'sentry.interfaces.csp.Csp',
    'device': 'sentry.interfaces.device.Device',
    'exception': 'sentry.interfaces.exception.Exception',
    'logentry': 'sentry.interfaces.message.Message',
    'query': 'sentry.interfaces.query.Query',
    'request': 'sentry.interfaces.http.Http',
    'sdk': 'sentry.interfaces.sdk.Sdk',
    'stacktrace': 'sentry.interfaces.stacktrace.Stacktrace',
    'template': 'sentry.interfaces.template.Template',
    'user': 'sentry.interfaces.user.User',
    'applecrashreport': 'sentry.interfaces.applecrash.AppleCrashReport',
    'breadcrumbs': 'sentry.interfaces.breadcrumbs.Breadcrumbs',
    'sentry.interfaces.Exception': 'sentry.interfaces.exception.Exception',
    'sentry.interfaces.Message': 'sentry.interfaces.message.Message',
    'sentry.interfaces.Stacktrace': 'sentry.interfaces.stacktrace.Stacktrace',
    'sentry.interfaces.Template': 'sentry.interfaces.template.Template',
    'sentry.interfaces.Query': 'sentry.interfaces.query.Query',
    'sentry.interfaces.Http': 'sentry.interfaces.http.Http',
    'sentry.interfaces.User': 'sentry.interfaces.user.User',
    'sentry.interfaces.Csp': 'sentry.interfaces.csp.Csp',
    'sentry.interfaces.AppleCrashReport': 'sentry.interfaces.applecrash.AppleCrashReport',
    'sentry.interfaces.Breadcrumbs': 'sentry.interfaces.breadcrumbs.Breadcrumbs',
}

SENTRY_EMAIL_BACKEND_ALIASES = {
    'smtp': 'django.core.mail.backends.smtp.EmailBackend',
    'dummy': 'django.core.mail.backends.dummy.EmailBackend',
    'console': 'django.core.mail.backends.console.EmailBackend',
}

# set of backends that do not support needing SMTP mail.* settings
# This list is a bit fragile and hardcoded, but it's unlikely that
# a user will be using a different backend that also mandates SMTP
# credentials.
SENTRY_SMTP_DISABLED_BACKENDS = frozenset((
    'django.core.mail.backends.dummy.EmailBackend',
    'django.core.mail.backends.console.EmailBackend',
    'django.core.mail.backends.locmem.EmailBackend',
    'django.core.mail.backends.filebased.EmailBackend',
    'sentry.utils.email.PreviewBackend',
))

# Should users without superuser permissions be allowed to
# make projects public
SENTRY_ALLOW_PUBLIC_PROJECTS = True

# Can users be invited to organizations?
SENTRY_ENABLE_INVITES = True

# Default to not sending the Access-Control-Allow-Origin header on api/store
SENTRY_ALLOW_ORIGIN = None

# Enable scraping of javascript context for source code
SENTRY_SCRAPE_JAVASCRIPT_CONTEXT = True

# Buffer backend
SENTRY_BUFFER = 'sentry.buffer.Buffer'
SENTRY_BUFFER_OPTIONS = {}

# Cache backend
# XXX: We explicitly require the cache to be configured as its not optional
# and causes serious confusion with the default django cache
SENTRY_CACHE = None
SENTRY_CACHE_OPTIONS = {}

# The internal Django cache is still used in many places
# TODO(dcramer): convert uses over to Sentry's backend
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.dummy.DummyCache',
    }
}

# The cache version affects both Django's internal cache (at runtime) as well
# as Sentry's cache. This automatically overrides VERSION on the default
# CACHES backend.
CACHE_VERSION = 1

# Digests backend
SENTRY_DIGESTS = 'sentry.digests.backends.dummy.DummyBackend'
SENTRY_DIGESTS_OPTIONS = {}

# Quota backend
SENTRY_QUOTAS = 'sentry.quotas.Quota'
SENTRY_QUOTA_OPTIONS = {}

# Rate limiting backend
SENTRY_RATELIMITER = 'sentry.ratelimits.base.RateLimiter'
SENTRY_RATELIMITER_OPTIONS = {}

# The default value for project-level quotas
SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE = '90%'

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
    (10, 360),  # 60 minutes at 10 seconds
    (3600, 24 * 7),  # 7 days at 1 hour
    (3600 * 24, 60),  # 60 days at 1 day
)


# File storage
SENTRY_FILESTORE = 'django.core.files.storage.FileSystemStorage'
SENTRY_FILESTORE_OPTIONS = {'location': '/tmp/sentry-files'}

# Internal metrics
SENTRY_METRICS_BACKEND = 'sentry.metrics.dummy.DummyMetricsBackend'
SENTRY_METRICS_OPTIONS = {}
SENTRY_METRICS_SAMPLE_RATE = 1.0
SENTRY_METRICS_PREFIX = 'sentry.'

# URI Prefixes for generating DSN URLs
# (Defaults to URL_PREFIX by default)
SENTRY_ENDPOINT = None
SENTRY_PUBLIC_ENDPOINT = None

# Prevent variables (e.g. context locals, http data, etc) from exceeding this
# size in characters
SENTRY_MAX_VARIABLE_SIZE = 512

# Prevent variables within extra context from exceeding this size in
# characters
SENTRY_MAX_EXTRA_VARIABLE_SIZE = 4096 * 4  # 16kb

# For changing the amount of data seen in Http Response Body part.
SENTRY_MAX_HTTP_BODY_SIZE = 4096 * 4  # 16kb

# For various attributes we don't limit the entire attribute on size, but the
# individual item. In those cases we also want to limit the maximum number of
# keys
SENTRY_MAX_DICTIONARY_ITEMS = 50

SENTRY_MAX_MESSAGE_LENGTH = 1024 * 8
SENTRY_MAX_STACKTRACE_FRAMES = 50
SENTRY_MAX_EXCEPTIONS = 25

# Gravatar service base url
SENTRY_GRAVATAR_BASE_URL = 'https://secure.gravatar.com'

# Timeout (in seconds) for fetching remote source files (e.g. JS)
SENTRY_SOURCE_FETCH_TIMEOUT = 5

# List of IP subnets which should not be accessible
SENTRY_DISALLOWED_IPS = ()

# Fields which managed users cannot change via Sentry UI. Username and password
# cannot be changed by managed users. Optionally include 'email' and
# 'name' in SENTRY_MANAGED_USER_FIELDS.
SENTRY_MANAGED_USER_FIELDS = ('email',)

SENTRY_SCOPES = set([
    'org:read',
    'org:write',
    'org:delete',
    'member:read',
    'member:write',
    'member:delete',
    'team:read',
    'team:write',
    'team:delete',
    'project:read',
    'project:write',
    'project:delete',
    'event:read',
    'event:write',
    'event:delete',
])

SENTRY_DEFAULT_ROLE = 'member'

# Roles are ordered, which represents a sort-of hierarchy, as well as how
# they're presented in the UI. This is primarily important in that a member
# that is earlier in the chain cannot manage the settings of a member later
# in the chain (they still require the appropriate scope).
SENTRY_ROLES = (
    {
        'id': 'member',
        'name': 'Member',
        'desc': 'Members can view and act on events, as well as view most other data within the organization.',
        'scopes': set([
            'event:read', 'event:write', 'event:delete',
            'project:read', 'org:read', 'member:read', 'team:read',
        ]),
    },
    {
        'id': 'admin',
        'name': 'Admin',
        'desc': 'Admin privileges on any teams of which they\'re a member. They can create new teams and projects, as well as remove teams and projects which they already hold membership on.',
        'scopes': set([
            'event:read', 'event:write', 'event:delete',
            'org:read', 'member:read',
            'project:read', 'project:write', 'project:delete',
            'team:read', 'team:write', 'team:delete',
        ]),
    },
    {
        'id': 'manager',
        'name': 'Manager',
        'desc': 'Gains admin access on all teams as well as the ability to add and remove members.',
        'is_global': True,
        'scopes': set([
            'event:read', 'event:write', 'event:delete',
            'member:read', 'member:write', 'member:delete',
            'project:read', 'project:write', 'project:delete',
            'team:read', 'team:write', 'team:delete',
            'org:read', 'org:write',
        ]),
    },
    {
        'id': 'owner',
        'name': 'Owner',
        'desc': 'Gains full permission across the organization. Can manage members as well as perform catastrophic operations such as removing the organization.',
        'is_global': True,
        'scopes': set([
            'org:read', 'org:write', 'org:delete',
            'member:read', 'member:write', 'member:delete',
            'team:read', 'team:write', 'team:delete',
            'project:read', 'project:write', 'project:delete',
            'event:read', 'event:write', 'event:delete',
        ]),
    },
)

# See sentry/options/__init__.py for more information
SENTRY_OPTIONS = {}
SENTRY_DEFAULT_OPTIONS = {
    # Make this unique, and don't share it with anybody.
    'system.secret-key': hashlib.md5(socket.gethostname() + ')*)&8a36)6%74e@-ne5(-!8a(vv#tkv)(eyg&@0=zd^pl!7=y@').hexdigest(),
}

# You should not change this setting after your database has been created
# unless you have altered all schemas first
SENTRY_USE_BIG_INTS = False

# Delay (in ms) to induce on API responses
SENTRY_API_RESPONSE_DELAY = 0

# Watchers for various application purposes (such as compiling static media)
# XXX(dcramer): this doesn't work outside of a source distribution as the
# webpack.config.js is not part of Sentry's datafiles
SENTRY_WATCHERS = (
    ('webpack', [os.path.join(NODE_MODULES_ROOT, '.bin', 'webpack'), '--output-pathinfo', '--watch',
     "--config={}".format(os.path.normpath(os.path.join(PROJECT_ROOT, os.pardir, os.pardir, "webpack.config.js")))]),
)

# statuspage.io support
STATUS_PAGE_ID = None
STATUS_PAGE_API_HOST = 'statuspage.io'


def get_raven_config():
    return {
        'release': sentry.__build__,
        'register_signals': True,
        'include_paths': [
            'sentry',
        ],
    }

RAVEN_CONFIG = get_raven_config()

# Config options that are explicitly disabled from Django
DEAD = object()

# This will eventually get set from values in SENTRY_OPTIONS during
# sentry.runner.initializer:bootstrap_options
SECRET_KEY = DEAD
EMAIL_BACKEND = DEAD
EMAIL_HOST = DEAD
EMAIL_PORT = DEAD
EMAIL_HOST_USER = DEAD
EMAIL_HOST_PASSWORD = DEAD
EMAIL_USE_TLS = DEAD
SERVER_EMAIL = DEAD
EMAIL_SUBJECT_PREFIX = DEAD
