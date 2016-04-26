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
PY_CONFIG_TEMPLATE = u"""
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
DEBUG = %(debug_flag)s

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
# CSRF_COOKIE_SECURE = True

# If you're not hosting at the root of your web server,
# you need to uncomment and set it to the path where Sentry is hosted.
# FORCE_SCRIPT_NAME = '/sentry'

SENTRY_WEB_HOST = '0.0.0.0'
SENTRY_WEB_PORT = 9000
SENTRY_WEB_OPTIONS = {
    # 'workers': 3,  # the number of web workers
    # 'protocol': 'uwsgi',  # Enable uwsgi protocol instead of http
}
"""
YAML_CONFIG_TEMPLATE = u"""\
# While a lot of configuration in Sentry can be changed via the UI, for all
# new-style config (as of 8.0) you can also declare values here in this file
# to enforce defaults or to ensure they cannot be changed via the UI. For more
# information see the Sentry documentation.

###############
# Mail Server #
###############

mail.backend: '%(mail.backend)s'  # Use dummy if you want to disable email entirely
# mail.host: 'localhost'
# mail.port: 25
# mail.username: ''
# mail.password: ''
# mail.use-tls: false
# The email address to send on behalf of
# mail.from: 'root@localhost'

# If you'd like to configure email replies, enable this.
# mail.enable-replies: false

# When email-replies are enabled, this value is used in the Reply-To header
# mail.reply-hostname: ''

# If you're using mailgun for inbound mail, set your API key and configure a
# route to forward to /api/hooks/mailgun/inbound/
# mail.mailgun-api-key: ''

###################
# System Settings #
###################

# If this file ever becomes compromised, it's important to regenerate your a new key
# Changing this value will result in all current sessions being invalidated.
# A new key can be generated with `$ sentry config generate-secret-key`
system.secret-key: '%(secret_key)s'

# The ``redis.clusters`` setting is used, unsurprisingly, to configure Redis
# clusters. These clusters can be then referred to by name when configuring
# backends such as the cache, digests, or TSDB backend.
redis.clusters:
  default:
    hosts:
      0:
        host: 127.0.0.1
        port: 6379
"""


def generate_secret_key():
    from django.utils.crypto import get_random_string
    chars = u'abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*(-_=+)'
    return get_random_string(50, chars)


def generate_settings(dev=False):
    """
    This command is run when ``default_path`` doesn't exist, or ``init`` is
    run and returns a string representing the default data to put into their
    settings file.
    """
    context = {
        'secret_key': generate_secret_key(),
        'debug_flag': dev,
        'mail.backend': 'console' if dev else 'smtp',
    }

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


def discover_configs():
    """
    Discover the locations of three configuration components:
     * Config directory (~/.sentry)
     * Optional python config file (~/.sentry/sentry.conf.py)
     * Optional yaml config (~/.sentry/config.yml)
    """
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

    # Make sure that our warnings are always displayed
    import warnings
    warnings.filterwarnings('default', '', Warning, r'^sentry')

    # Add in additional mimetypes that are useful for our static files
    # which aren't common in default system registries
    import mimetypes
    for type, ext in (
        ('application/json', 'map'),
        ('application/font-woff', 'woff'),
        ('application/font-woff2', 'woff2'),
        ('application/vnd.ms-fontobject', 'eot'),
        ('application/x-font-ttf', 'ttf'),
        ('application/x-font-ttf', 'ttc'),
        ('font/opentype', 'otf'),
    ):
        mimetypes.add_type(type, '.' + ext)

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

    # Add autoreload for config.yml file if needed
    if 'UWSGI_PY_AUTORELOAD' in os.environ:
        if yaml is not None and os.path.exists(yaml):
            try:
                import uwsgi
                from uwsgidecorators import filemon
            except ImportError:
                pass
            else:
                filemon(yaml)(uwsgi.reload)

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
