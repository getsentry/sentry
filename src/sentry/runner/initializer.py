"""
sentry.runner.initializer
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import os
import click


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
    'cache.backend': 'SENTRY_CACHE',
    'cache.options': 'SENTRY_CACHE_OPTIONS',
    'system.databases': 'DATABASES',
    'system.debug': 'DEBUG',
    'system.secret-key': 'SECRET_KEY',
    'redis.options': 'SENTRY_REDIS_OPTIONS',
}


def bootstrap_options(settings, config):
    """
    Quickly bootstrap options that come in from a config file
    and convert options into Django settings that are
    required to even initialize the rest of the app.
    """
    if config is None:
        return
    from sentry.utils.yaml import safe_load
    with open(config, 'rb') as fp:
        options = safe_load(fp)
    for k, v in options.iteritems():
        # Stuff everything else into SENTRY_OPTIONS
        # these will be validated later after bootstrapping
        settings.SENTRY_OPTIONS[k] = v
        # Escalate the few needed to actually get the app bootstrapped into settings
        if k in options_mapper:
            setattr(settings, options_mapper[k], v)


def initialize_app(config, skip_backend_validation=False):
    settings = config['settings']

    bootstrap_options(settings, config['options'])

    fix_south(settings)

    apply_legacy_settings(settings)

    install_plugin_apps(settings)

    # Commonly setups don't correctly configure themselves for production envs
    # so lets try to provide a bit more guidance
    if settings.CELERY_ALWAYS_EAGER and not settings.DEBUG:
        import warnings
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
    env.data['config'] = config['config_path']
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
    options = settings.SENTRY_OPTIONS
    for k, v in options.iteritems():
        # TODO(mattrobenolt): Validate settings.SENTRY_OPTIONS.
        pass


def fix_south(settings):
    # South needs an adapter defined conditionally
    if settings.DATABASES['default']['ENGINE'] != 'sentry.db.postgres':
        return

    settings.SOUTH_DATABASE_ADAPTERS = {
        'default': 'south.db.postgresql_psycopg2'
    }


def show_big_error(message):
    click.echo('', err=True)
    click.secho('!! %s !!' % ('!' * min(len(message), 80),), err=True, fg='red')
    click.secho('!! %s !!' % message, err=True, fg='red')
    click.secho('!! %s !!' % ('!' * min(len(message), 80),), err=True, fg='red')
    click.echo('', err=True)


def apply_legacy_settings(settings):
    # SENTRY_USE_QUEUE used to determine if Celery was eager or not
    if hasattr(settings, 'SENTRY_USE_QUEUE'):
        import warnings
        warnings.warn('SENTRY_USE_QUEUE is deprecated. Please use CELERY_ALWAYS_EAGER instead. '
                      'See https://docs.getsentry.com/on-premise/server/queue/ for more information.', DeprecationWarning)
        settings.CELERY_ALWAYS_EAGER = (not settings.SENTRY_USE_QUEUE)

    if not settings.SENTRY_ADMIN_EMAIL:
        show_big_error('system.admin-email is not configured')
    elif not isinstance(settings.SENTRY_ADMIN_EMAIL, basestring):
        show_big_error('system.admin-email must be a string')

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
        import warnings
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
