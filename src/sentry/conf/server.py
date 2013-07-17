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
    'sentry.plugins.sentry_servers',
    'sentry.plugins.sentry_urls',
    'sentry.plugins.sentry_useragents',
    'social_auth',
    'south',
    'static_compiler',
    'django_social_auth_trello',
)

STATIC_ROOT = os.path.join(PROJECT_ROOT, 'static')
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
    'social_auth.backends.google.GoogleOAuthBackend',
    'social_auth.backends.google.GoogleOAuth2Backend',
    'social_auth.backends.google.GoogleBackend',
    'social_auth.backends.yahoo.YahooBackend',
    'social_auth.backends.browserid.BrowserIDBackend',
    'social_auth.backends.contrib.linkedin.LinkedinBackend',
    'social_auth.backends.contrib.livejournal.LiveJournalBackend',
    'social_auth.backends.contrib.orkut.OrkutBackend',
    'social_auth.backends.contrib.foursquare.FoursquareBackend',
    'social_auth.backends.contrib.github.GithubBackend',
    'social_auth.backends.contrib.dropbox.DropboxBackend',
    'social_auth.backends.contrib.flickr.FlickrBackend',
    'social_auth.backends.contrib.instagram.InstagramBackend',
    'social_auth.backends.contrib.skyrock.SkyrockBackend',
    'social_auth.backends.contrib.yahoo.YahooOAuthBackend',
    'social_auth.backends.OpenIDBackend',
    'social_auth.backends.contrib.bitbucket.BitbucketBackend',
    'social_auth.backends.contrib.mixcloud.MixcloudBackend',
    'social_auth.backends.contrib.live.LiveBackend',
    'django_social_auth_trello.backend.TrelloBackend',
    'sentry.utils.auth.EmailAuthBackend',
)

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

SOCIAL_AUTH_CREATE_USERS = True

import random

SOCIAL_AUTH_DEFAULT_USERNAME = lambda: random.choice(['Darth Vader', 'Obi-Wan Kenobi', 'R2-D2', 'C-3PO', 'Yoda'])
SOCIAL_AUTH_PROTECTED_USER_FIELDS = ['email']

# Queue configuration

BROKER_URL = "django://"

CELERY_IGNORE_RESULT = True
CELERY_SEND_EVENTS = False
CELERY_RESULT_BACKEND = None
CELERY_TASK_RESULT_EXPIRES = 1
CELERY_DISABLE_RATE_LIMITS = True

# Sentry and Raven configuration

SENTRY_PUBLIC = False
SENTRY_PROJECT = 1
SENTRY_CACHE_BACKEND = 'default'

EMAIL_SUBJECT_PREFIX = '[Sentry] '

# Disable South in tests as it is sending incorrect create signals
SOUTH_TESTS_MIGRATE = False

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

# We only define static bundles if NPM has been setup
if os.path.exists(NPM_ROOT):
    STATIC_BUNDLES = {
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
                    "sentry/scripts/lib/jquery.flot.min.js",
                    "sentry/scripts/lib/simple-slider.js",
                    "sentry/scripts/lib/json2.js",
                    "sentry/scripts/lib/underscore.js",
                    "sentry/scripts/lib/backbone.js",
                    "sentry/scripts/lib/select2/select2.js",
                    "sentry/scripts/lib/bootstrap.js",
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

# Configure celery
import djcelery
djcelery.setup_loader()
