"""
sentry.runner.commands.upgrade
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import click
from sentry.runner.decorators import configuration


@click.command()
@click.option('--verbosity', '-v', default=1, help='Verbosity level.')
@click.option('--traceback', default=True, is_flag=True, help='Raise on exception.')
@click.option('--noinput', default=False, is_flag=True, help='Do not prompt the user for input of any kind.')
@configuration
@click.pass_context
def upgrade(ctx, verbosity, traceback, noinput):
    "Perform any pending database migrations and upgrades."

    from django.core.management import call_command as dj_call_command
    dj_call_command(
        'syncdb',
        interactive=not noinput,
        traceback=traceback,
        verbosity=verbosity,
    )

    dj_call_command(
        'migrate',
        merge=True,
        ignore_ghost_migrations=True,
        interactive=not noinput,
        traceback=traceback,
        verbosity=verbosity,
    )

    from sentry.runner import call_command
    call_command(
        'sentry.runner.commands.repair.repair',
    )
