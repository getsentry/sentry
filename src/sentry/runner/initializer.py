"""
sentry.runner.initializer
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import os

import click

from sentry.utils import warnings
from sentry.utils.warnings import DeprecatedSettingWarning


def install_plugin_apps(settings):
    # entry_points={
    #    'sentry.apps': [
    #         'phabricator = sentry_phabricator'
    #     ],
    # },
    from pkg_resources import iter_entry_points
    installed_apps = list(settings.INSTALLED_APPS)
    for ep in iter_entry_points('sentry.apps'):
        installed_apps.append(ep.module_name)
    settings.INSTALLED_APPS = tuple(installed_apps)


def register_plugins(settings):
    from pkg_resources import iter_entry_points
    from sentry.plugins import register
    # entry_points={
    #    'sentry.plugins': [
    #         'phabricator = sentry_phabricator.plugins:PhabricatorPlugin'
    #     ],
    # },

    for ep in iter_entry_points('sentry.plugins'):
        try:
            plugin = ep.load()
        except Exception:
            import traceback
            click.echo("Failed to load plugin %r:\n%s" % (ep.name, traceback.format_exc()), err=True)
        else:
            register(plugin)


def initialize_receivers():
    # force signal registration
    import sentry.receivers  # NOQA


def get_asset_version(settings):
    path = os.path.join(settings.STATIC_ROOT, 'version')
    try:
        with open(path) as fp:
            return fp.read().strip()
    except IOError:
        from time import time
        return int(time())


# Options which must get extracted into Django settings while
# bootstrapping. Everything else will get validated and used
# as a part of OptionsManager.
options_mapper = {
    # 'cache.backend': 'SENTRY_CACHE',
    # 'cache.options': 'SENTRY_CACHE_OPTIONS',
    # 'system.databases': 'DATABASES',
    # 'system.debug': 'DEBUG',
    'system.secret-key': 'SECRET_KEY',
    'mail.backend': 'EMAIL_BACKEND',
    'mail.host': 'EMAIL_HOST',
    'mail.port': 'EMAIL_PORT',
    'mail.username': 'EMAIL_HOST_USER',
    'mail.password': 'EMAIL_HOST_PASSWORD',
    'mail.use-tls': 'EMAIL_USE_TLS',
    'mail.from': 'SERVER_EMAIL',
    'mail.subject-prefix': 'EMAIL_SUBJECT_PREFIX',
}


def bootstrap_options(settings, config=None):
    """
    Quickly bootstrap options that come in from a config file
    and convert options into Django settings that are
    required to even initialize the rest of the app.
    """
    # Make sure our options have gotten registered
    from sentry.options import load_defaults
    load_defaults()

    options = {}
    if config is not None:
        # Attempt to load our config yaml file
        from sentry.utils.yaml import safe_load
        from yaml.parser import ParserError
        from yaml.scanner import ScannerError
        try:
            with open(config, 'rb') as fp:
                options = safe_load(fp)
        except IOError:
            # Gracefully fail if yaml file doesn't exist
            pass
        except (AttributeError, ParserError, ScannerError) as e:
            from .importer import ConfigurationError
            raise ConfigurationError('Malformed config.yml file: %s' % unicode(e))

        # Empty options file, so fail gracefully
        if options is None:
            options = {}
        # Options needs to be a dict
        elif not isinstance(options, dict):
            from .importer import ConfigurationError
            raise ConfigurationError('Malformed config.yml file')

    from sentry.conf.server import DEAD

    # First move options from settings into options
    for k, v in options_mapper.iteritems():
        if getattr(settings, v, DEAD) is not DEAD and k not in options:
            warnings.warn(
                DeprecatedSettingWarning(
                    options_mapper[k],
                    "SENTRY_OPTIONS['%s']" % k,
                )
            )
            options[k] = getattr(settings, v)

    # Stuff everything else into SENTRY_OPTIONS
    # these will be validated later after bootstrapping
    for k, v in options.iteritems():
        settings.SENTRY_OPTIONS[k] = v

    # Now go back through all of SENTRY_OPTIONS and promote
    # back into settings. This catches the case when values are defined
    # only in SENTRY_OPTIONS and no config.yml file
    for o in (settings.SENTRY_DEFAULT_OPTIONS, settings.SENTRY_OPTIONS):
        for k, v in o.iteritems():
            if k in options_mapper:
                # Map the mail.backend aliases to something Django understands
                if k == 'mail.backend':
                    try:
                        v = settings.SENTRY_EMAIL_BACKEND_ALIASES[v]
                    except KeyError:
                        pass
                # Escalate the few needed to actually get the app bootstrapped into settings
                setattr(settings, options_mapper[k], v)


def initialize_app(config, skip_backend_validation=False):
    settings = config['settings']

    bootstrap_options(settings, config['options'])

    fix_south(settings)

    apply_legacy_settings(settings)

    bind_cache_to_option_store()

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

    register_plugins(settings)

    initialize_receivers()

    validate_options(settings)

    if not skip_backend_validation:
        validate_backends()

    from django.utils import timezone
    from sentry.app import env
    from sentry.runner.settings import get_sentry_conf
    env.data['config'] = get_sentry_conf()
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


def validate_options(settings):
    from sentry.options import default_manager
    default_manager.validate(settings.SENTRY_OPTIONS, warn=True)


def fix_south(settings):
    settings.SOUTH_DATABASE_ADAPTERS = {}

    # South needs an adapter defined conditionally
    for key, value in settings.DATABASES.iteritems():
        if value['ENGINE'] != 'sentry.db.postgres':
            continue
        settings.SOUTH_DATABASE_ADAPTERS[key] = 'south.db.postgresql_psycopg2'


def bind_cache_to_option_store():
    # The default ``OptionsStore`` instance is initialized without the cache
    # backend attached. The store itself utilizes the cache during normal
    # operation, but can't use the cache before the options (which typically
    # includes the cache configuration) have been bootstrapped from the legacy
    # settings and/or configuration values. Those options should have been
    # loaded at this point, so we can plug in the cache backend before
    # continuing to initialize the remainder of the application.
    from sentry.cache import default_cache
    from sentry.options import default_store

    default_store.cache = default_cache


def show_big_error(message):
    if isinstance(message, basestring):
        lines = message.splitlines()
    else:
        lines = message
    maxline = max(map(len, lines))
    click.echo('', err=True)
    click.secho('!! %s !!' % ('!' * min(maxline, 80),), err=True, fg='red')
    for line in lines:
        click.secho('!! %s !!' % line.center(maxline), err=True, fg='red')
    click.secho('!! %s !!' % ('!' * min(maxline, 80),), err=True, fg='red')
    click.echo('', err=True)


def apply_legacy_settings(settings):
    from sentry import options

    # SENTRY_USE_QUEUE used to determine if Celery was eager or not
    if hasattr(settings, 'SENTRY_USE_QUEUE'):
        warnings.warn(
            DeprecatedSettingWarning(
                'SENTRY_USE_QUEUE',
                'CELERY_ALWAYS_EAGER',
                'https://docs.getsentry.com/on-premise/server/queue/',
            )
        )
        settings.CELERY_ALWAYS_EAGER = (not settings.SENTRY_USE_QUEUE)

    for old, new in (
        ('SENTRY_ADMIN_EMAIL', 'system.admin-email'),
        ('SENTRY_URL_PREFIX', 'system.url-prefix'),
        ('SENTRY_SYSTEM_MAX_EVENTS_PER_MINUTE', 'system.rate-limit'),
        ('SENTRY_ENABLE_EMAIL_REPLIES', 'mail.enable-replies'),
        ('SENTRY_SMTP_HOSTNAME', 'mail.reply-hostname'),
        ('MAILGUN_API_KEY', 'mail.mailgun-api-key'),
    ):
        if new not in settings.SENTRY_OPTIONS and hasattr(settings, old):
            warnings.warn(
                DeprecatedSettingWarning(old, "SENTRY_OPTIONS['%s']" % new))
            settings.SENTRY_OPTIONS[new] = getattr(settings, old)

    if hasattr(settings, 'SENTRY_REDIS_OPTIONS'):
        if 'redis.clusters' in settings.SENTRY_OPTIONS:
            raise Exception("Cannot specify both SENTRY_OPTIONS['redis.clusters'] option and SENTRY_REDIS_OPTIONS setting.")
        else:
            warnings.warn(
                DeprecatedSettingWarning(
                    'SENTRY_REDIS_OPTIONS',
                    'SENTRY_OPTIONS["redis.clusters"]',
                    removed_in_version='8.5',
                )
            )
            settings.SENTRY_OPTIONS['redis.clusters'] = {
                'default': settings.SENTRY_REDIS_OPTIONS,
            }
    else:
        # Provide backwards compatibility to plugins expecting there to be a
        # ``SENTRY_REDIS_OPTIONS`` setting by using the ``default`` cluster.
        # This should be removed when ``SENTRY_REDIS_OPTIONS`` is officially
        # deprecated. (This also assumes ``FLAG_NOSTORE`` on the configuration
        # option.)
        settings.SENTRY_REDIS_OPTIONS = options.get('redis.clusters')['default']

    if not hasattr(settings, 'SENTRY_URL_PREFIX'):
        url_prefix = options.get('system.url-prefix', silent=True)
        if not url_prefix:
            # HACK: We need to have some value here for backwards compatibility
            url_prefix = 'http://sentry.example.com'
        settings.SENTRY_URL_PREFIX = url_prefix

    if settings.TIME_ZONE != 'UTC':
        # non-UTC timezones are not supported
        show_big_error('TIME_ZONE should be set to UTC')

    # Set ALLOWED_HOSTS if it's not already available
    if not settings.ALLOWED_HOSTS:
        settings.ALLOWED_HOSTS = ['*']

    if hasattr(settings, 'SENTRY_ALLOW_REGISTRATION'):
        warnings.warn(DeprecatedSettingWarning('SENTRY_ALLOW_REGISTRATION', 'SENTRY_FEATURES["auth:register"]'))
        settings.SENTRY_FEATURES['auth:register'] = settings.SENTRY_ALLOW_REGISTRATION

    settings.DEFAULT_FROM_EMAIL = settings.SENTRY_OPTIONS.get(
        'mail.from', settings.SENTRY_DEFAULT_OPTIONS.get('mail.from'))


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
        settings, 'social_auth', 'social_auth_association')
