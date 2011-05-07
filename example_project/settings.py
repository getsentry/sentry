import os.path
import sys
# Django settings for example_project project.

DEBUG = True
TEMPLATE_DEBUG = True

ADMINS = (
    # ('Your Name', 'your_email@domain.com'),
)

INTERNAL_IPS = ('127.0.0.1',)

MANAGERS = ADMINS

PROJECT_ROOT = os.path.dirname(__file__)

sys.path.insert(0, os.path.abspath(os.path.join(PROJECT_ROOT, '..')))

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql_psycopg2', # Add 'postgresql_psycopg2', 'postgresql', 'mysql', 'sqlite3' or 'oracle'.
        'NAME': 'sentry',                      # Or path to database file if using sqlite3.
        'USER': 'postgres',                      # Not used with sqlite3.
        'PASSWORD': '',                  # Not used with sqlite3.
        'HOST': '',                      # Set to empty string for localhost. Not used with sqlite3.
        'PORT': '',                      # Set to empty string for default. Not used with sqlite3.
    }
}

# Local time zone for this installation. Choices can be found here:
# http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
# although not all choices may be available on all operating systems.
# On Unix systems, a value of None will cause Django to use the same
# timezone as the operating system.
# If running in a Windows environment this must be set to the same as your
# system time zone.
TIME_ZONE = 'America/Los_Angeles'

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

# Absolute path to the directory that holds media.
# Example: "/home/media/media.lawrence.com/"
MEDIA_ROOT = ''

# URL that handles the media served from MEDIA_ROOT. Make sure to use a
# trailing slash if there is a path component (optional in other cases).
# Examples: "http://media.lawrence.com", "http://example.com/media/"
MEDIA_URL = ''

# URL prefix for admin media -- CSS, JavaScript and images. Make sure to use a
# trailing slash.
# Examples: "http://foo.com/media/", "/media/".
ADMIN_MEDIA_PREFIX = '/media/'

# Make this unique, and don't share it with anybody.
SECRET_KEY = ')*)&8a36)6%74e@-ne5(-!8a(vv#tkv)(eyg&@0=zd^pl!7=y@'

# List of callables that know how to import templates from various sources.
TEMPLATE_LOADERS = (
    'django.template.loaders.filesystem.Loader',
    'django.template.loaders.app_directories.Loader',
#     'django.template.loaders.eggs.Loader',
)

MIDDLEWARE_CLASSES = (
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
)

ROOT_URLCONF = 'example_project.urls'

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
    'django.contrib.messages',
    'sentry',
    'sentry.client',
    'sentry.plugins.sentry_redmine',
    'sentry.plugins.sentry_servers',
    'sentry.plugins.sentry_sites',
    'sentry.plugins.sentry_urls',
    'haystack',
    'south',
    # Uncomment the next line to enable the admin:
    # 'django.contrib.admin',
)

import logging
logging.basicConfig(level=logging.DEBUG)

SENTRY_THRASHING_TIMEOUT = 0
SENTRY_TESTING = True
SENTRY_SITE = 'example'
SENTRY_PUBLIC = False

SENTRY_FILTERS = (
    'example_project.filters.IPFilter',
    'sentry.filters.StatusFilter',
    'sentry.filters.LoggerFilter',
    'sentry.filters.LevelFilter',
    'sentry.filters.ServerNameFilter',
    'sentry.filters.SiteFilter',
)
SENTRY_SEARCH_ENGINE = 'whoosh'
SENTRY_SEARCH_OPTIONS = {
    'path': os.path.join(PROJECT_ROOT, 'sentry_index'),
}

try:
    import debug_toolbar
except ImportError, exc:
    pass
else:
    INSTALLED_APPS = INSTALLED_APPS + (
        'debug_toolbar',
    )
    
    MIDDLEWARE_CLASSES = MIDDLEWARE_CLASSES + (
        'debug_toolbar.middleware.DebugToolbarMiddleware',
    )

try:
    from local_settings import *
except ImportError, e:
    print e
    pass