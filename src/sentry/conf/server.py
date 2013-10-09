"""
sentry.conf.server
~~~~~~~~~~~~~~~~~~

These settings act as the default (base) settings for the Sentry-provided web-server

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.conf.global_settings import *  # NOQA

import hashlib
import os
import os.path
import socket
import sys
import urlparse

DEBUG = False
TEMPLATE_DEBUG = True

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
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'sentry.middleware.SentryMiddleware',
    'sentry.middleware.SentrySocialAuthExceptionMiddleware',
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
    'django.contrib.auth',
    'django.contrib.admin',
    'django.contrib.contenttypes',
    'django.contrib.messages',
    'django.contrib.sessions',
    'django.contrib.sites',
    'django.contrib.staticfiles',

    'crispy_forms',
    'djcelery',
    'gunicorn',
    'kombu.transport.django',
    'raven.contrib.django.raven_compat',
    'sentry',
    'sentry.plugins.sentry_interface_types',
    'sentry.plugins.sentry_mail',
    'sentry.plugins.sentry_urls',
    'sentry.plugins.sentry_useragents',
    'social_auth',
    'south',
    'static_compiler',
)

STATIC_ROOT = os.path.realpath(os.path.join(PROJECT_ROOT, 'static'))
STATIC_URL = '/_static/'

STATICFILES_FINDERS = (
    "django.contrib.staticfiles.finders.FileSystemFinder",
    "django.contrib.staticfiles.finders.AppDirectoriesFinder",
    "static_compiler.finders.StaticCompilerFinder",
)

LOCALE_PATHS = (
    os.path.join(PROJECT_ROOT, 'locale'),
)

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

SOCIAL_AUTH_USER_MODEL = AUTH_USER_MODEL = 'auth.User'

SESSION_ENGINE = "django.contrib.sessions.backends.signed_cookies"

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
from kombu import Queue

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
CELERY_QUEUES = (
    Queue('default', routing_key='default'),
    Queue('celery', routing_key='celery'),
    Queue('alerts', routing_key='alerts'),
    Queue('cleanup', routing_key='cleanup'),
    Queue('sourcemaps', routing_key='sourcemaps'),
    Queue('search', routing_key='search'),
    Queue('counters', routing_key='counters'),
    Queue('events', routing_key='events'),
    Queue('triggers', routing_key='triggers'),
    Queue('update', routing_key='update'),
)

# Disable South in tests as it is sending incorrect create signals
SOUTH_TESTS_MIGRATE = True

LOGGING = {
    'version': 1,
    'disable_existing_loggers': True,
    'handlers': {
        'console': {
            'level': 'WARNING',
            'class': 'logging.StreamHandler'
        },
        'sentry': {
            'class': 'raven.contrib.django.handlers.SentryHandler',
        }
    },
    'formatters': {
        'client_info': {
            'format': '%(name)s %(levelname)s %(project_slug)s/%(team_slug)s %(message)s'
        }
    },
    'loggers': {
        '()': {
            'handlers': ['console', 'sentry'],
        },
        'root': {
            'handlers': ['console', 'sentry'],
        },
        'sentry': {
            'level': 'ERROR',
            'handlers': ['console', 'sentry'],
            'propagate': False,
        },
        'sentry.coreapi': {
            'formatter': 'client_info',
        },
        'sentry.errors': {
            'level': 'ERROR',
            'handlers': ['console'],
            'propagate': False,
        },
        'django.request': {
            'level': 'ERROR',
            'handlers': ['console'],
            'propagate': False,
        },
    }
}

NPM_ROOT = os.path.abspath(os.path.join(PROJECT_ROOT, os.pardir, os.pardir, 'node_modules'))

SENTRY_STATIC_BUNDLES = {
    "packages": {
        "sentry/scripts/global.min.js": {
            "src": [
                "sentry/scripts/core.js",
                "sentry/scripts/models.js",
                "sentry/scripts/templates.js",
                "sentry/scripts/utils.js",
                "sentry/scripts/collections.js",
                "sentry/scripts/charts.js",
                "sentry/scripts/views.js",
                "sentry/scripts/app.js",
            ],
        },
        "sentry/scripts/legacy.min.js": {
            "src": [
                "sentry/scripts/sentry.core.js",
                "sentry/scripts/sentry.charts.js",
                "sentry/scripts/sentry.stream.js",
            ],
        },
        "sentry/scripts/lib.min.js": {
            "src": [
                "sentry/scripts/lib/jquery.js",
                "sentry/scripts/lib/jquery-migrate.js",
                "sentry/scripts/lib/jquery.animate-colors.js",
                "sentry/scripts/lib/jquery.clippy.min.js",
                "sentry/scripts/lib/jquery.cookie.js",
                "sentry/scripts/lib/jquery.flot.js",
                "sentry/scripts/lib/jquery.flot.dashes.js",
                "sentry/scripts/lib/jquery.flot.resize.js",
                "sentry/scripts/lib/jquery.flot.time.js",
                "sentry/scripts/lib/moment.js",
                "sentry/scripts/lib/simple-slider.js",
                "sentry/scripts/lib/json2.js",
                "sentry/scripts/lib/underscore.js",
                "sentry/scripts/lib/backbone.js",
                "sentry/scripts/lib/select2/select2.js",
            ],
        },
        "sentry/scripts/bootstrap.min.js": {
            "src": [
                "sentry/bootstrap/js/bootstrap-transition.js",
                "sentry/bootstrap/js/bootstrap-alert.js",
                "sentry/bootstrap/js/bootstrap-button.js",
                "sentry/bootstrap/js/bootstrap-carousel.js",
                "sentry/bootstrap/js/bootstrap-collapse.js",
                "sentry/bootstrap/js/bootstrap-dropdown.js",
                "sentry/bootstrap/js/bootstrap-modal.js",
                "sentry/bootstrap/js/bootstrap-tooltip.js",
                "sentry/bootstrap/js/bootstrap-popover.js",
                "sentry/bootstrap/js/bootstrap-scrollspy.js",
                "sentry/bootstrap/js/bootstrap-tab.js",
                "sentry/bootstrap/js/bootstrap-typeahead.js",
                "sentry/bootstrap/js/bootstrap-affix.js",
                "sentry/scripts/lib/bootstrap-datepicker.js"
            ],
        },
        "sentry/styles/global.min.css": {
            "src": {
                "sentry/less/sentry.less": "sentry/styles/sentry.css",
            },
        },
        "sentry/styles/wall.min.css": {
            "src": {
                "sentry/less/wall.less": "sentry/styles/wall.css",
            },
        },
    },
    "postcompilers": {
        "*.js": ["node_modules/uglify-js/bin/uglifyjs {input} --source-map-root={relroot}/ --source-map-url={name}.map{ext} --source-map={relpath}/{name}.map{ext} -o {output}"],
    },
    "preprocessors": {
        "*.less": ["node_modules/less/bin/lessc {input} {output}"],
    },
}

# We only define static bundles if NPM has been setup
if os.path.exists(NPM_ROOT):
    STATIC_BUNDLES = SENTRY_STATIC_BUNDLES

# Sentry and Raven configuration

SENTRY_PUBLIC = False
SENTRY_PROJECT = 1
SENTRY_CACHE_BACKEND = 'default'

SENTRY_FILTERS = (
    'sentry.filters.StatusFilter',
)

SENTRY_KEY = None

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

# Queue (Kombu)
SENTRY_QUEUE = {
    'transport': 'kombu.transport.django.Transport',
}

SENTRY_ALLOWED_INTERFACES = set([
    'sentry.interfaces.Exception',
    'sentry.interfaces.Message',
    'sentry.interfaces.Stacktrace',
    'sentry.interfaces.Template',
    'sentry.interfaces.Query',
    'sentry.interfaces.Http',
    'sentry.interfaces.User',
])

# Should users without 'sentry.add_project' permissions be allowed
# to create new projects
SENTRY_ALLOW_PROJECT_CREATION = False

# Should users without 'sentry.add_team' permissions be allowed
# to create new projects
SENTRY_ALLOW_TEAM_CREATION = False

# Should users without superuser permissions be allowed to
# make projects public
SENTRY_ALLOW_PUBLIC_PROJECTS = True

# Should users be allowed to register an account? If this is disabled
# accounts can only be created when someone is invited or added
# manually.
SENTRY_ALLOW_REGISTRATION = True

# Instructs Sentry to utilize it's internal search indexer on all incoming
# events..
SENTRY_USE_SEARCH = True

# Enable trend results. These can be expensive and are calculated in real-time.
# When disabled they will be replaced w/ a default priority sort.
SENTRY_USE_TRENDING = True

# Default to not sending the Access-Control-Allow-Origin header on api/store
SENTRY_ALLOW_ORIGIN = None

# Enable scraping of javascript context for source code
SENTRY_SCRAPE_JAVASCRIPT_CONTEXT = True

# Redis connection information (see Nydus documentation)
SENTRY_REDIS_OPTIONS = {}

# Buffer backend to use
SENTRY_BUFFER = 'sentry.buffer.Buffer'
SENTRY_BUFFER_OPTIONS = {}

SENTRY_QUOTAS = 'sentry.quotas.Quota'
SENTRY_QUOTA_OPTIONS = {}
# The default value for project-level quotas
SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE = '90%'
# The maximum number of events per minute the system should accept.
SENTRY_SYSTEM_MAX_EVENTS_PER_MINUTE = 0

SENTRY_RAVEN_JS_URL = 'd3nslu0hdya83q.cloudfront.net/dist/1.0/raven.min.js'

# URI Prefixes for generating DSN URLs
# (Defaults to URL_PREFIX by default)
SENTRY_ENDPOINT = None
SENTRY_PUBLIC_ENDPOINT = None

# Early draft features. Not slated or public release yet.
SENTRY_ENABLE_EXPLORE_CODE = False
SENTRY_ENABLE_EXPLORE_USERS = True

# Configure celery
import djcelery
djcelery.setup_loader()
