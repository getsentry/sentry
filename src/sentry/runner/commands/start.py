"""
sentry.runner.commands.start
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import sys
import click
from sentry.runner.decorators import configuration

SERVICES = {
    'http': 'sentry.services.http.SentryHTTPServer',
    'smtp': 'sentry.services.smtp.SentrySMTPServer',
}


@click.command()
@click.option('--bind', '-b', default=None, help='Bind address.', metavar='ADDRESS')
@click.option('--workers', '-w', default=0, help='The number of worker processes for handling requests.')
@click.option('--upgrade', default=False, is_flag=True, help='Upgrade before starting.')
@click.option('--noinput', default=False, is_flag=True, help='Do not prompt the user for input of any kind.')
@click.argument('service', default='http', type=click.Choice(sorted(SERVICES.keys())))
@configuration
@click.pass_context
def start(ctx, service, bind, workers, upgrade, noinput):
    "DEPRECATED see `sentry run` instead."

    from sentry.runner.initializer import show_big_error
    show_big_error([
        '`sentry start%s` is deprecated.' % (' ' + service if 'http' in sys.argv else ''),
        'Use `sentry run %s` instead.' % {'http': 'web'}.get(service, service),
    ])

    if bind:
        if ':' in bind:
            host, port = bind.split(':', 1)
            port = int(port)
        else:
            host = bind
            port = None
    else:
        host, port = None, None

    if upgrade:
        click.echo('Performing upgrade before service startup...')
        from sentry.runner import call_command
        call_command(
            'sentry.runner.commands.upgrade.upgrade',
            verbosity=0, noinput=noinput,
        )

    click.echo('Running service: %r' % service)

    # remove command line arguments to avoid optparse failures with service code
    # that calls call_command which reparses the command line, and if --noupgrade is supplied
    # a parse error is thrown
    sys.argv = sys.argv[:1]

    from sentry.utils.imports import import_string
    import_string(SERVICES[service])(
        host=host,
        port=port,
        workers=workers,
    ).run()
