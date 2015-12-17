"""
sentry.runner.commands.config
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import click
from sentry.runner.decorators import configuration


@click.group()
def config():
    "Manage runtime config options."


@config.command()
@click.option('--silent', default=False, is_flag=True, help='Suppress extraneous output.')
@click.argument('option')
@configuration
def get(option, silent):
    "Get a configuration option."
    from django.conf import settings
    from sentry.options import default_manager as manager
    from sentry.options.manager import UnknownOption
    try:
        key = manager.lookup_key(option)
    except UnknownOption:
        raise click.ClickException('unknown option: %s' % option)
    value = manager.get(key.name)
    if silent:
        click.echo(value)
        return
    # TODO(mattrobenolt): Add help to option keys
    # if key.help:
    #     click.echo(key.help + '\n')
    click.echo(' from config: %s' % settings.SENTRY_OPTIONS.get(key.name, '<not set>'))
    click.echo('     current: %s' % value)


@config.command()
@click.argument('option')
@click.argument('value')
@configuration
def set(option, value):
    "Set a configuration option to a new value."
    from sentry import options
    from sentry.options.manager import UnknownOption
    try:
        options.set(option, value)
    except UnknownOption:
        raise click.ClickException('unknown option: %s' % option)
    except TypeError as e:
        raise click.ClickException(unicode(e))


@config.command()
@click.option('--no-input', default=False, is_flag=True, help='Do not show confirmation.')
@click.argument('option')
@configuration
def delete(option, no_input):
    "Delete/unset a configuration option."
    from sentry import options
    from sentry.options.manager import UnknownOption
    if not no_input:
        click.confirm('Are you sure you want to delete "%s"?' % option, default=False, abort=True)
    try:
        options.delete(option)
    except UnknownOption:
        raise click.ClickException('unknown option: %s' % option)
