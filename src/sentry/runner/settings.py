"""
sentry.runner.settings
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import os
import click


DEFAULT_SETTINGS_MODULE = 'sentry.conf.server'
DEFAULT_SETTINGS_CONF = 'config.yml'
DEFAULT_SETTINGS_OVERRIDE = 'sentry.conf.py'
PY_CONFIG_TEMPLATE = """
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

# If you're using a reverse SSL proxy, you should enable the X-Forwarded-Proto
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
"""
YAML_CONFIG_TEMPLATE = """\
# While a lot of configuration in Sentry can be changed via the UI, for all
# new-style config (as of 8.0) you can also declare values here in this file
# to enforce defaults or to ensure they cannot be changed via the UI. For more
# information see the Sentry documentation.

# If this file ever becomes compromised, it's important to regenerate your SECRET_KEY
# Changing this value will result in all current sessions being invalidated
system.secret-key: '%(secret_key)s'
"""


def generate_secret_key():
    from django.utils.crypto import get_random_string
    chars = 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*(-_=+)'
    return get_random_string(50, chars)


def generate_settings():
    """
    This command is run when ``default_path`` doesn't exist, or ``init`` is
    run and returns a string representing the default data to put into their
    settings file.
    """
    context = {'secret_key': generate_secret_key()}
    py = PY_CONFIG_TEMPLATE % context
    yaml = YAML_CONFIG_TEMPLATE % context
    return py, yaml


def get_sentry_conf():
    """
    Fetch the SENTRY_CONF value, either from the click context
    if available, or SENTRY_CONF environment variable.
    """
    try:
        ctx = click.get_current_context()
        return ctx.obj['config']
    except (RuntimeError, KeyError):
        try:
            return os.environ['SENTRY_CONF']
        except KeyError:
            return '~/.sentry'


def discover_configs(ctx=None):
    """
    Discover the locations of three configuration components:
     * Config directory (~/.sentry)
     * Optional python config file (~/.sentry/sentry.conf.py)
     * Optional yaml config (~/.sentry/config.yml)
    """
    if ctx and 'config' in ctx.obj:
        config = ctx.obj['config']
    else:
        try:
            config = os.environ['SENTRY_CONF']
        except KeyError:
            config = '~/.sentry'

    config = os.path.expanduser(config)

    # This is the old, now deprecated code path where SENTRY_CONF is pointed directly
    # to a python file
    if config.endswith(('.py', '.conf')) or os.path.isfile(config):
        return (
            os.path.dirname(config),
            config,
            None,
        )

    return (
        config,
        os.path.join(config, DEFAULT_SETTINGS_OVERRIDE),
        os.path.join(config, DEFAULT_SETTINGS_CONF),
    )


def configure(ctx, py, yaml, skip_backend_validation=False):
    """
    Given the two different config files, set up the environment.

    NOTE: Will only execute once, so it's safe to call multiple times.
    """
    global __installed
    if __installed:
        return

    from .importer import install

    if yaml is None:
        # `yaml` will be None when SENTRY_CONF is pointed
        # directly to a file, in which case, this file must exist
        if not os.path.exists(py):
            if ctx:
                raise click.ClickException("Configuration file does not exist. Use 'sentry init' to initialize the file.")
            raise ValueError("Configuration file does not exist at '%s'" % click.format_filename(py))
    elif not os.path.exists(yaml) and not os.path.exists(py):
        if ctx:
            raise click.ClickException("Configuration file does not exist. Use 'sentry init' to initialize the file.")
        raise ValueError("Configuration file does not exist at '%s'" % click.format_filename(yaml))

    os.environ['DJANGO_SETTINGS_MODULE'] = 'sentry_config'

    install('sentry_config', py, DEFAULT_SETTINGS_MODULE)

    # HACK: we need to force access of django.conf.settings to
    # ensure we don't hit any import-driven recursive behavior
    from django.conf import settings
    hasattr(settings, 'INSTALLED_APPS')

    from .initializer import initialize_app, on_configure
    initialize_app({
        'config_path': py,
        'settings': settings,
        'options': yaml,
    }, skip_backend_validation=skip_backend_validation)
    on_configure({'settings': settings})

    __installed = True


__installed = False
