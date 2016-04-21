"""
sentry.runner.commands.run
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import click

from sentry.runner.decorators import configuration


class AddressParamType(click.ParamType):
    name = 'address'

    def __call__(self, value, param=None, ctx=None):
        if value is None:
            return (None, None)
        return self.convert(value, param, ctx)

    def convert(self, value, param, ctx):
        if ':' in value:
            host, port = value.split(':', 1)
            port = int(port)
        else:
            host = value
            port = None
        return host, port


ADDRESS = AddressParamType()


@click.group()
def run():
    "Run a service."


@run.command()
@click.option('--bind', '-b', default=None, help='Bind address.', type=ADDRESS)
@click.option('--workers', '-w', default=0, help='The number of worker processes for handling requests.')
@click.option('--upgrade', default=False, is_flag=True, help='Upgrade before starting.')
@click.option('--noinput', default=False, is_flag=True, help='Do not prompt the user for input of any kind.')
@configuration
def web(bind, workers, upgrade, noinput):
    "Run web service."
    if upgrade:
        click.echo('Performing upgrade before service startup...')
        from sentry.runner import call_command
        call_command(
            'sentry.runner.commands.upgrade.upgrade',
            verbosity=0, noinput=noinput,
        )

    from sentry.services.http import SentryHTTPServer
    SentryHTTPServer(
        host=bind[0],
        port=bind[1],
        workers=workers,
    ).run()


@run.command()
@click.option('--bind', '-b', default=None, help='Bind address.', type=ADDRESS)
@click.option('--upgrade', default=False, is_flag=True, help='Upgrade before starting.')
@click.option('--noinput', default=False, is_flag=True, help='Do not prompt the user for input of any kind.')
@configuration
def smtp(bind, upgrade, noinput):
    "Run inbound email service."
    if upgrade:
        click.echo('Performing upgrade before service startup...')
        from sentry.runner import call_command
        call_command(
            'sentry.runner.commands.upgrade.upgrade',
            verbosity=0, noinput=noinput,
        )

    from sentry.services.smtp import SentrySMTPServer
    SentrySMTPServer(
        host=bind[0],
        port=bind[1],
    ).run()
