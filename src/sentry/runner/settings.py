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
CONFIG_TEMPLATE = """# https://docs.getsentry.com/

###########
# General #
###########

system.databases:
  default:
    ENGINE: 'sentry.db.postgres'
    NAME: 'sentry'
    USER: 'matt'
    PASSWORD: ''
    HOST: ''
    PORT: ''

cache.backend: 'sentry.cache.redis.RedisCache'
# cache.options: {}

redis.options:
  hosts:
    0:
      host: '127.0.0.1'
      port: 6379

########
# etc. #
########

# If this file ever becomes compromised, it's important to regenerate your SECRET_KEY
# Changing this value will result in all current sessions being invalidated
system.secret-key: %(default_key)r
"""


def generate_settings():
    """
    This command is run when ``default_path`` doesn't exist, or ``init`` is
    run and returns a string representing the default data to put into their
    settings file.
    """
    from base64 import b64encode
    output = CONFIG_TEMPLATE % dict(
        default_key=b64encode(os.urandom(40)),
    )
    return output


def discover_configs(ctx=None):
    """
    Discover the locations of three configuration components:
     * Config directory (~/.sentry)
     * Optional python config file (~/.sentry/sentry.conf.py)
     * Optional yaml config (~/.sentry/config.yml)
    """
    if ctx:
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


def configure(ctx, py, yaml):
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
                raise click.ClickException("Configuration file does not exist. Use '%s init' to initialize the file." % ctx.command_path)
            raise ValueError("Configuration file does not exist at '%s'" % click.format_filename(py))
    elif not os.path.exists(yaml):
        if ctx:
            raise click.ClickException("Configuration file does not exist. Use '%s init' to initialize the file." % ctx.command_path)
        raise ValueError("Configuration file does not exist at '%s'" % click.format_filename(yaml))

    os.environ['DJANGO_SETTINGS_MODULE'] = 'sentry_config'
    install('sentry_config', py, DEFAULT_SETTINGS_MODULE)

    # TODO(mattrobenolt): clean up this and use the callbacks from install
    from django.conf import settings
    from .initializer import initialize_app, on_configure
    initialize_app({
        'config_path': py,
        'settings': settings,
        'options': yaml,
    }, skip_backend_validation=True)  # TODO(mattrobenolt): Bring back env var
    on_configure({'settings': settings})

    __installed = True


__installed = False
