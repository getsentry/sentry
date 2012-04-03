"""
sentry.conf.server
~~~~~~~~~~~~~~~~~~

These settings act as the default (base) settings for the Sentry-provided web-server

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.conf.global_settings import *

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

PROJECT_ROOT = os.path.join(os.path.dirname(__file__), os.pardir, os.pardir)

sys.path.insert(0, os.path.abspath(os.path.join(PROJECT_ROOT, '..')))

CACHE_BACKEND = 'locmem:///'

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

# Make this unique, and don't share it with anybody.
SECRET_KEY = hashlib.md5(socket.gethostname() + ')*)&8a36)6%74e@-ne5(-!8a(vv#tkv)(eyg&@0=zd^pl!7=y@').hexdigest()

# List of callables that know how to import templates from various sources.
TEMPLATE_LOADERS = (
    'django.template.loaders.filesystem.Loader',
    'django.template.loaders.app_directories.Loader',
#     'django.template.loaders.eggs.Loader',
)

MIDDLEWARE_CLASSES = (
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'sentry.middleware.SentryMiddleware',
    # 'django.contrib.messages.middleware.MessageMiddleware',
)

ROOT_URLCONF = 'sentry.conf.urls'

TEMPLATE_DIRS = (
    # Put strings here, like "/home/html/django_templates" or "C:/www/django/templates".
    # Always use forward slashes, even on Windows.
    # Don't forget to use absolute paths, not relative paths.
    os.path.join(PROJECT_ROOT, 'templates'),
)

INSTALLED_APPS = (
    'django.contrib.auth',
    'django.contrib.admin',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.sites',
    # 'django.contrib.messages',

    'djcelery',
    'kombu.transport.django',
    'raven.contrib.django',
    'sentry',
    'sentry.plugins.sentry_servers',
    'sentry.plugins.sentry_urls',
    'sentry.plugins.sentry_sites',
    'sentry.plugins.sentry_mail',
    'south',
)

ADMIN_MEDIA_PREFIX = '/_admin_media/'

# Queue configuration

BROKER_URL = "django://"

CELERY_IGNORE_RESULT = True
CELERY_SEND_EVENTS = False
CELERY_RESULT_BACKEND = None
CELERY_TASK_RESULT_EXPIRES = 1


# Sentry and Raven configuration

SENTRY_PUBLIC = False
SENTRY_PROJECT = 1
SENTRY_CACHE_BACKEND = 'default'

EMAIL_SUBJECT_PREFIX = '[Sentry] '

# Configure logging
from raven.conf import setup_logging
from raven.contrib.django.handlers import SentryHandler
import logging

# Configure root logger
logger = logging.getLogger()
logger.setLevel(logging.INFO)

handler = logging.StreamHandler()
handler.setLevel(logging.INFO)
logger.addHandler(handler)

# Disable django.request as it's generally useless
logger = logging.getLogger('django.request')
logger.propagate = False
logger.addHandler(handler)

# Configure default sentry logging
sentry_handler = SentryHandler()
sentry_handler.setLevel(logging.ERROR)
setup_logging(sentry_handler)

# Configure celery
import djcelery
djcelery.setup_loader()
