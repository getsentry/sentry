#!/usr/bin/env python
"""
sentry.utils.runner
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from logan.runner import run_app, configure_app

import base64
import os
import sys
import pkg_resources
import warnings

from functools import partial

USE_GEVENT = os.environ.get('USE_GEVENT') == '1'
SKIP_BACKEND_VALIDATION = os.environ.get('SKIP_BACKEND_VALIDATION') == '1'

KEY_LENGTH = 40

CONFIG_TEMPLATE = """
# This file is just Python, with a touch of Django which means
# you can inherit and tweak settings to your hearts content.
from sentry.conf.server import *

import os.path

CONF_ROOT = os.path.dirname(__file__)

DATABASES = {
    'default': {
        'ENGINE': 'sentry.db.postgres',
        'NAME': 'sentry',
        'USER': 'postgres',
        'PASSWORD': '',
        'HOST': '',
        'PORT': '',
    }
}

# You should not change this setting after your database has been created
# unless you have altered all schemas first
SENTRY_USE_BIG_INTS = True

# If you're expecting any kind of real traffic on Sentry, we highly recommend
# configuring the CACHES and Redis settings

###########
# General #
###########

# The administrative email for this installation.
# Note: This will be reported back to getsentry.com as the point of contact. See
# the beacon documentation for more information. This **must** be a string.

# SENTRY_ADMIN_EMAIL = 'your.name@example.com'
SENTRY_ADMIN_EMAIL = ''

# Instruct Sentry that this install intends to be run by a single organization
# and thus various UI optimizations should be enabled.
SENTRY_SINGLE_ORGANIZATION = True

#########
# Redis #
#########

# Generic Redis configuration used as defaults for various things including:
# Buffers, Quotas, TSDB

SENTRY_REDIS_OPTIONS = {
    'hosts': {
        0: {
            'host': '127.0.0.1',
            'port': 6379,
        }
    }
}

#########
# Cache #
#########

# Sentry currently utilizes two separate mechanisms. While CACHES is not a
# requirement, it will optimize several high throughput patterns.

# If you wish to use memcached, install the dependencies and adjust the config
# as shown:
#
#   pip install python-memcached
#
# CACHES = {
#     'default': {
#         'BACKEND': 'django.core.cache.backends.memcached.MemcachedCache',
#         'LOCATION': ['127.0.0.1:11211'],
#     }
# }

# A primary cache is required for things such as processing events
SENTRY_CACHE = 'sentry.cache.redis.RedisCache'

#########
# Queue #
#########

# See https://docs.getsentry.com/on-premise/server/queue/ for more
# information on configuring your queue broker and workers. Sentry relies
# on a Python framework called Celery to manage queues.

CELERY_ALWAYS_EAGER = False
BROKER_URL = 'redis://localhost:6379'

###############
# Rate Limits #
###############

# Rate limits apply to notification handlers and are enforced per-project
# automatically.

SENTRY_RATELIMITER = 'sentry.ratelimits.redis.RedisRateLimiter'

##################
# Update Buffers #
##################

# Buffers (combined with queueing) act as an intermediate layer between the
# database and the storage API. They will greatly improve efficiency on large
# numbers of the same events being sent to the API in a short amount of time.
# (read: if you send any kind of real data to Sentry, you should enable buffers)

SENTRY_BUFFER = 'sentry.buffer.redis.RedisBuffer'

##########
# Quotas #
##########

# Quotas allow you to rate limit individual projects or the Sentry install as
# a whole.

SENTRY_QUOTAS = 'sentry.quotas.redis.RedisQuota'

########
# TSDB #
########

# The TSDB is used for building charts as well as making things like per-rate
# alerts possible.

SENTRY_TSDB = 'sentry.tsdb.redis.RedisTSDB'

###########
# Digests #
###########

# The digest backend powers notification summaries.

SENTRY_DIGESTS = 'sentry.digests.backends.redis.RedisBackend'

################
# File storage #
################

# Any Django storage backend is compatible with Sentry. For more solutions see
# the django-storages package: https://django-storages.readthedocs.org/en/latest/

SENTRY_FILESTORE = 'django.core.files.storage.FileSystemStorage'
SENTRY_FILESTORE_OPTIONS = {
    'location': '/tmp/sentry-files',
}

##############
# Web Server #
##############

# You MUST configure the absolute URI root for Sentry:
SENTRY_URL_PREFIX = 'http://sentry.example.com'  # No trailing slash!

# If you're using a reverse proxy, you should enable the X-Forwarded-Proto
# header and uncomment the following settings
# SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
# SESSION_COOKIE_SECURE = True

# If you're not hosting at the root of your web server, and not using uWSGI,
# you need to uncomment and set it to the path where Sentry is hosted.
# FORCE_SCRIPT_NAME = '/sentry'

SENTRY_WEB_HOST = '0.0.0.0'
SENTRY_WEB_PORT = 9000
SENTRY_WEB_OPTIONS = {
    # 'workers': 3,  # the number of gunicorn workers
    # 'secure_scheme_headers': {'X-FORWARDED-PROTO': 'https'},
}

###############
# Mail Server #
###############

# For more information check Django's documentation:
# https://docs.djangoproject.com/en/1.6/topics/email/

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

EMAIL_HOST = 'localhost'
EMAIL_HOST_PASSWORD = ''
EMAIL_HOST_USER = ''
EMAIL_PORT = 25
EMAIL_USE_TLS = False

# The email address to send on behalf of
SERVER_EMAIL = 'root@localhost'

# If you're using mailgun for inbound mail, set your API key and configure a
# route to forward to /api/hooks/mailgun/inbound/
MAILGUN_API_KEY = ''

########
# etc. #
########

# If this file ever becomes compromised, it's important to regenerate your SECRET_KEY
# Changing this value will result in all current sessions being invalidated
SECRET_KEY = %(default_key)r
"""


def generate_settings():
    """
    This command is run when ``default_path`` doesn't exist, or ``init`` is
    run and returns a string representing the default data to put into their
    settings file.
    """
    output = CONFIG_TEMPLATE % dict(
        default_key=base64.b64encode(os.urandom(KEY_LENGTH)),
    )

    return output


def install_plugin_apps(settings):
    # entry_points={
    #    'sentry.apps': [
    #         'phabricator = sentry_phabricator'
    #     ],
    # },
    installed_apps = list(settings.INSTALLED_APPS)
    for ep in pkg_resources.iter_entry_points('sentry.apps'):
        installed_apps.append(ep.module_name)
    settings.INSTALLED_APPS = tuple(installed_apps)


def register_plugins(settings):
    from sentry.plugins import register
    # entry_points={
    #    'sentry.plugins': [
    #         'phabricator = sentry_phabricator.plugins:PhabricatorPlugin'
    #     ],
    # },

    for ep in pkg_resources.iter_entry_points('sentry.plugins'):
        try:
            plugin = ep.load()
        except Exception:
            import sys
            import traceback

            sys.stderr.write("Failed to load plugin %r:\n%s\n" % (ep.name, traceback.format_exc()))
        else:
            register(plugin)


def initialize_receivers():
    # force signal registration
    import sentry.receivers  # NOQA


def initialize_gevent():
    from gevent import monkey
    monkey.patch_all()

    try:
        import psycopg2  # NOQA
    except ImportError:
        pass
    else:
        from sentry.utils.gevent import make_psycopg_green
        make_psycopg_green()


def get_asset_version(settings):
    path = os.path.join(settings.STATIC_ROOT, 'version')
    try:
        with open(path) as fp:
            return fp.read().strip()
    except IOError:
        from time import time
        return int(time())


def initialize_app(config, skip_backend_validation=False):
    settings = config['settings']

    fix_south(settings)

    apply_legacy_settings(settings)

    install_plugin_apps(settings)

    # Commonly setups don't correctly configure themselves for production envs
    # so lets try to provide a bit more guidance
    if settings.CELERY_ALWAYS_EAGER and not settings.DEBUG:
        warnings.warn('Sentry is configured to run asynchronous tasks in-process. '
                      'This is not recommended within production environments. '
                      'See https://docs.getsentry.com/on-premise/server/queue/ for more information.')

    if settings.SENTRY_SINGLE_ORGANIZATION:
        settings.SENTRY_FEATURES['organizations:create'] = False

    settings.SUDO_COOKIE_SECURE = getattr(settings, 'SESSION_COOKIE_SECURE', False)
    settings.SUDO_COOKIE_DOMAIN = getattr(settings, 'SESSION_COOKIE_DOMAIN', None)
    settings.SUDO_COOKIE_PATH = getattr(settings, 'SESSION_COOKIE_PATH', '/')

    settings.CSRF_COOKIE_SECURE = getattr(settings, 'SESSION_COOKIE_SECURE', False)
    settings.CSRF_COOKIE_DOMAIN = getattr(settings, 'SESSION_COOKIE_DOMAIN', None)
    settings.CSRF_COOKIE_PATH = getattr(settings, 'SESSION_COOKIE_PATH', '/')

    settings.CACHES['default']['VERSION'] = settings.CACHE_VERSION

    settings.ASSET_VERSION = get_asset_version(settings)
    settings.STATIC_URL = settings.STATIC_URL.format(
        version=settings.ASSET_VERSION,
    )

    if USE_GEVENT:
        from django.db import connections
        connections['default'].allow_thread_sharing = True

    register_plugins(settings)

    initialize_receivers()

    if not (skip_backend_validation or SKIP_BACKEND_VALIDATION):
        validate_backends()

    from django.utils import timezone
    from sentry.app import env
    env.data['config'] = config.get('config_path')
    env.data['start_date'] = timezone.now()


def validate_backends():
    from sentry import app

    backends = (
        app.buffer,
        app.digests,
        app.nodestore,
        app.quotas,
        app.ratelimiter,
        app.search,
        app.tsdb,
    )

    for backend in backends:
        backend.validate()


def fix_south(settings):
    # South needs an adapter defined conditionally
    if settings.DATABASES['default']['ENGINE'] != 'sentry.db.postgres':
        return

    settings.SOUTH_DATABASE_ADAPTERS = {
        'default': 'south.db.postgresql_psycopg2'
    }


def show_big_error(message):
    sys.stderr.write('\n')
    sys.stderr.write('\033[91m!! %s !!\033[0m\n' % ('!' * min(len(message), 80),))
    sys.stderr.write('\033[91m!! %s !!\033[0m\n' % message)
    sys.stderr.write('\033[91m!! %s !!\033[0m\n' % ('!' * min(len(message), 80),))
    sys.stderr.write('\n')


def apply_legacy_settings(settings):
    # SENTRY_USE_QUEUE used to determine if Celery was eager or not
    if hasattr(settings, 'SENTRY_USE_QUEUE'):
        warnings.warn('SENTRY_USE_QUEUE is deprecated. Please use CELERY_ALWAYS_EAGER instead. '
                      'See https://docs.getsentry.com/on-premise/server/queue/ for more information.', DeprecationWarning)
        settings.CELERY_ALWAYS_EAGER = (not settings.SENTRY_USE_QUEUE)

    if not settings.SENTRY_ADMIN_EMAIL:
        show_big_error('SENTRY_ADMIN_EMAIL is not configured')
    elif not isinstance(settings.SENTRY_ADMIN_EMAIL, basestring):
        show_big_error('SENTRY_ADMIN_EMAIL must be a string')

    if settings.SENTRY_URL_PREFIX in ('', 'http://sentry.example.com') and not settings.DEBUG:
        # Maybe also point to a piece of documentation for more information?
        # This directly coincides with users getting the awkward
        # `ALLOWED_HOSTS` exception.
        show_big_error('SENTRY_URL_PREFIX is not configured')
        # Set `ALLOWED_HOSTS` to the catch-all so it works
        settings.ALLOWED_HOSTS = ['*']

    if settings.TIME_ZONE != 'UTC':
        # non-UTC timezones are not supported
        show_big_error('TIME_ZONE should be set to UTC')

    # Set ALLOWED_HOSTS if it's not already available
    if not settings.ALLOWED_HOSTS:
        from urlparse import urlparse
        urlbits = urlparse(settings.SENTRY_URL_PREFIX)
        if urlbits.hostname:
            settings.ALLOWED_HOSTS = (urlbits.hostname,)

    if hasattr(settings, 'SENTRY_ALLOW_REGISTRATION'):
        warnings.warn('SENTRY_ALLOW_REGISTRATION is deprecated. Use SENTRY_FEATURES instead.', DeprecationWarning)
        settings.SENTRY_FEATURES['auth:register'] = settings.SENTRY_ALLOW_REGISTRATION


def skip_migration_if_applied(settings, app_name, table_name,
                              name='0001_initial'):
    from south.migration import Migrations
    from sentry.utils.db import table_exists
    import types

    if app_name not in settings.INSTALLED_APPS:
        return

    migration = Migrations(app_name)[name]

    def skip_if_table_exists(original):
        def wrapped(self):
            # TODO: look into why we're having to return some ridiculous
            # lambda
            if table_exists(table_name):
                return lambda x=None: None
            return original()
        wrapped.__name__ = original.__name__
        return wrapped

    migration.forwards = types.MethodType(
        skip_if_table_exists(migration.forwards), migration)


def on_configure(config):
    """
    Executes after settings are full installed and configured.

    At this point we can force import on various things such as models
    as all of settings should be correctly configured.
    """
    settings = config['settings']

    skip_migration_if_applied(
        settings, 'kombu.contrib.django', 'djkombu_queue')
    skip_migration_if_applied(
        settings, 'social_auth', 'social_auth_association')


def configure(config_path=None, skip_backend_validation=False):
    configure_app(
        project='sentry',
        config_path=config_path,
        default_config_path='~/.sentry/sentry.conf.py',
        default_settings='sentry.conf.server',
        settings_initializer=generate_settings,
        settings_envvar='SENTRY_CONF',
        initializer=partial(
            initialize_app, skip_backend_validation=skip_backend_validation),
        on_configure=on_configure,
    )


def main():
    if USE_GEVENT:
        sys.stderr.write("Configuring Sentry with gevent bindings\n")
        initialize_gevent()

    run_app(
        project='sentry',
        default_config_path='~/.sentry/sentry.conf.py',
        default_settings='sentry.conf.server',
        settings_initializer=generate_settings,
        settings_envvar='SENTRY_CONF',
        initializer=initialize_app,
    )

if __name__ == '__main__':
    main()
