"""
sentry.runner.commands.upgrade
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import click
from sentry.runner.decorators import configuration


def _upgrade(interactive, traceback, verbosity, repair):
    from django.core.management import call_command as dj_call_command
    dj_call_command(
        'syncdb',
        interactive=interactive,
        traceback=traceback,
        verbosity=verbosity,
    )

    dj_call_command(
        'migrate',
        merge=True,
        ignore_ghost_migrations=True,
        interactive=interactive,
        traceback=traceback,
        verbosity=verbosity,
    )

    if repair:
        from sentry.runner import call_command
        call_command(
            'sentry.runner.commands.repair.repair',
        )


@click.command()
@click.option('--verbosity', '-v', default=1, help='Verbosity level.')
@click.option('--traceback', default=True, is_flag=True, help='Raise on exception.')
@click.option('--noinput', default=False, is_flag=True, help='Do not prompt the user for input of any kind.')
@click.option('--lock', default=False, is_flag=True, help='Hold a global lock and limit upgrade to one concurrent.')
@click.option('--no-repair', default=False, is_flag=True, help='Skip repair step.')
@configuration
@click.pass_context
def upgrade(ctx, verbosity, traceback, noinput, lock, no_repair):
    "Perform any pending database migrations and upgrades."

    if lock:
        from sentry.app import locks
        from sentry.utils.locking import UnableToAcquireLock
        lock = locks.get('upgrade', duration=0)
        try:
            with lock.acquire():
                _upgrade(not noinput, traceback, verbosity, not no_repair)
        except UnableToAcquireLock:
            raise click.ClickException('Unable to acquire `upgrade` lock.')
    else:
        _upgrade(not noinput, traceback, verbosity, not no_repair)
