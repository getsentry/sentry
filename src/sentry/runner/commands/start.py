"""
sentry.runner.commands.start
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import click
from sentry.runner.decorators import configuration

SERVICES = {
    'http': 'sentry.services.http.SentryHTTPServer',
    'smtp': 'sentry.services.smtp.SentrySMTPServer',
}


@click.command()
@click.option('--bind', '-b', default=None, help='Bind address.', metavar='ADDRESS')
@click.option('--workers', '-w', default=3, show_default=True)
@click.option('--upgrade', default=False, is_flag=True, help='Upgrade before starting.')
@click.option('--noinput', default=False, is_flag=True, help='Do not prompt the user for input of any kind.')
@click.option('--debug', default=False, is_flag=True)
@click.argument('service', default='http', type=click.Choice(sorted(SERVICES.keys())))
@configuration
@click.pass_context
def start(ctx, service, bind, workers, debug, upgrade, noinput):
    "Start running a service."
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
    import sys
    sys.argv = sys.argv[:1]

    from sentry.utils.imports import import_string
    import_string(SERVICES[service])(
        debug=debug,
        host=host,
        port=port,
        workers=workers,
    ).run()
