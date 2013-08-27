#!/usr/bin/env python
"""
sentry.utils.runner
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from logan.runner import run_app, configure_app

import base64
import os
import pkg_resources
import warnings

KEY_LENGTH = 40

CONFIG_TEMPLATE = """
# This file is just Python, with a touch of Django which means you
# you can inherit and tweak settings to your hearts content.
from sentry.conf.server import *

import os.path

CONF_ROOT = os.path.dirname(__file__)

DATABASES = {
    'default': {
        # You can swap out the engine for MySQL easily by changing this value
        # to ``django.db.backends.mysql`` or to PostgreSQL with
        # ``django.db.backends.postgresql_psycopg2``

        # If you change this, you'll also need to install the appropriate python
        # package: psycopg2 (Postgres) or mysql-python
        'ENGINE': 'django.db.backends.sqlite3',

        'NAME': os.path.join(CONF_ROOT, 'sentry.db'),
        'USER': 'postgres',
        'PASSWORD': '',
        'HOST': '',
        'PORT': '',

        # If you're using Postgres, we recommend turning on autocommit
        # 'OPTIONS': {
        #     'autocommit': True,
        # }
    }
}


# If you're expecting any kind of real traffic on Sentry, we highly recommend
# configuring the CACHES and Redis settings

###########
## CACHE ##
###########

# You'll need to install the required dependencies for Memcached:
#   pip install python-memcached
#
# CACHES = {
#     'default': {
#         'BACKEND': 'django.core.cache.backends.memcached.MemcachedCache',
#         'LOCATION': ['127.0.0.1:11211'],
#     }
# }

###########
## Queue ##
###########

# See http://sentry.readthedocs.org/en/latest/queue/index.html for more
# information on configuring your queue broker and workers. Sentry relies
# on a Python framework called Celery to manage queues.

# You can enable queueing of jobs by turning off the always eager setting:
# CELERY_ALWAYS_EAGER = False
# BROKER_URL = 'redis://localhost:6379'

####################
## Update Buffers ##
####################

# Buffers (combined with queueing) act as an intermediate layer between the
# database and the storage API. They will greatly improve efficiency on large
# numbers of the same events being sent to the API in a short amount of time.
# (read: if you send any kind of real data to Sentry, you should enable buffers)

# You'll need to install the required dependencies for Redis buffers:
#   pip install redis hiredis nydus
#
# SENTRY_BUFFER = 'sentry.buffer.redis.RedisBuffer'
# SENTRY_REDIS_OPTIONS = {
#     'hosts': {
#         0: {
#             'host': '127.0.0.1',
#             'port': 6379,
#         }
#     }
# }

################
## Web Server ##
################

# You MUST configure the absolute URI root for Sentry:
SENTRY_URL_PREFIX = 'http://sentry.example.com'  # No trailing slash!

# If you're using a reverse proxy, you should enable the X-Forwarded-Proto
# header, and uncomment the following setting
# SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

SENTRY_WEB_HOST = '0.0.0.0'
SENTRY_WEB_PORT = 9000
SENTRY_WEB_OPTIONS = {
    'workers': 3,  # the number of gunicorn workers
    'secure_scheme_headers': {'X-FORWARDED-PROTO': 'https'},
}

#################
## Mail Server ##
#################

# For more information check Django's documentation:
#  https://docs.djangoproject.com/en/1.3/topics/email/?from=olddocs#e-mail-backends

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

EMAIL_HOST = 'localhost'
EMAIL_HOST_PASSWORD = ''
EMAIL_HOST_USER = ''
EMAIL_PORT = 25
EMAIL_USE_TLS = False

# The email address to send on behalf of
SERVER_EMAIL = 'root@localhost'

###########
## etc. ##
###########

# If this file ever becomes compromised, it's important to regenerate your SECRET_KEY
# Changing this value will result in all current sessions being invalidated
SECRET_KEY = %(default_key)r

# http://twitter.com/apps/new
# It's important that input a callback URL, even if its useless. We have no idea why, consult Twitter.
TWITTER_CONSUMER_KEY = ''
TWITTER_CONSUMER_SECRET = ''

# http://developers.facebook.com/setup/
FACEBOOK_APP_ID = ''
FACEBOOK_API_SECRET = ''

# http://code.google.com/apis/accounts/docs/OAuth2.html#Registering
GOOGLE_OAUTH2_CLIENT_ID = ''
GOOGLE_OAUTH2_CLIENT_SECRET = ''

# https://github.com/settings/applications/new
GITHUB_APP_ID = ''
GITHUB_API_SECRET = ''

# https://trello.com/1/appKey/generate
TRELLO_API_KEY = ''
TRELLO_API_SECRET = ''

# https://confluence.atlassian.com/display/BITBUCKET/OAuth+Consumers
BITBUCKET_CONSUMER_KEY = ''
BITBUCKET_CONSUMER_SECRET = ''
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


def install_plugins(settings):
    from sentry.plugins import register
    # entry_points={
    #    'sentry.plugins': [
    #         'phabricator = sentry_phabricator.plugins:PhabricatorPlugin'
    #     ],
    # },
    installed_apps = list(settings.INSTALLED_APPS)
    for ep in pkg_resources.iter_entry_points('sentry.apps'):
        try:
            plugin = ep.load()
        except Exception:
            import sys
            import traceback

            print >> sys.stderr, "Failed to load app %r:\n%s" % (ep.name, traceback.format_exc())
        else:
            installed_apps.append(ep.module_name)
    settings.INSTALLED_APPS = tuple(installed_apps)

    for ep in pkg_resources.iter_entry_points('sentry.plugins'):
        try:
            plugin = ep.load()
        except Exception:
            import sys
            import traceback

            print >> sys.stderr, "Failed to load plugin %r:\n%s" % (ep.name, traceback.format_exc())
        else:
            register(plugin)


def initialize_app(config):
    from django.utils import timezone
    from sentry.app import env

    env.data['config'] = config.get('config_path')
    env.data['start_date'] = timezone.now()

    install_plugins(config['settings'])

    skip_migration_if_applied(
        config['settings'], 'kombu.contrib.django', 'djkombu_queue')
    skip_migration_if_applied(
        config['settings'], 'social_auth', 'social_auth_association')

    apply_legacy_settings(config)


def apply_legacy_settings(config):
    settings = config['settings']

    # SENTRY_USE_QUEUE used to determine if Celery was eager or not
    if hasattr(settings, 'SENTRY_USE_QUEUE'):
        warnings.warn('SENTRY_USE_QUEUE is deprecated. Please use CELERY_ALWAYS_EAGER instead. '
                      'See http://sentry.readthedocs.org/en/latest/queue/index.html for more information.')
        settings.CELERY_ALWAYS_EAGER = (not settings.SENTRY_USE_QUEUE)

    # Set ALLOWED_HOSTS if it's not already available
    if not settings.ALLOWED_HOSTS and settings.SENTRY_URL_PREFIX:
        from urlparse import urlparse
        urlbits = urlparse(settings.SENTRY_URL_PREFIX)
        if urlbits.hostname:
            settings.ALLOWED_HOSTS = (urlbits.hostname,)

    if not settings.SERVER_EMAIL and hasattr(settings, 'SENTRY_SERVER_EMAIL'):
        warnings.warn('SENTRY_SERVER_URL is deprecated. Please use SERVER_URL instead.')
        settings.SERVER_EMAIL = settings.SENTRY_SERVER_EMAIL


def skip_migration_if_applied(settings, app_name, table_name,
                              name='0001_initial'):
    from south.migration import Migrations
    from sentry.utils.db import table_exists
    import types

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


def configure():
    configure_app(
        project='sentry',
        default_config_path='~/.sentry/sentry.conf.py',
        default_settings='sentry.conf.server',
        settings_initializer=generate_settings,
        settings_envvar='SENTRY_CONF',
        initializer=initialize_app,
    )


def main():
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
