"""
sentry.runner.commands.devserver
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import click
from sentry.runner.decorators import configuration


@click.command()
@click.option('--reload/--no-reload', default=True, help='Autoreloading of python files.')
@click.option('--watchers/--no-watchers', default=True, help='Watch static files and recompile on changes.')
@click.option('--workers/--no-workers', default=False, help='Run asynchronous workers.')
@click.argument('bind', default='127.0.0.1:8000', metavar='ADDRESS')
@configuration
def devserver(reload, watchers, workers, bind):
    "Starts a lightweight web server for development."
    if ':' in bind:
        host, port = bind.split(':', 1)
        port = int(port)
    else:
        host = bind
        port = None

    import os
    from django.conf import settings
    from sentry.services.http import SentryHTTPServer

    uwsgi_overrides = {
        # Make sure we don't try and use uwsgi protocol
        'protocol': 'http',
        # Make sure we reload really quickly for local dev in case it
        # doesn't want to shut down nicely on it's own, NO MERCY
        'worker-reload-mercy': 2,
    }

    if reload:
        uwsgi_overrides['py-autoreload'] = 1

    daemons = []

    if watchers:
        daemons += settings.SENTRY_WATCHERS

    if workers:
        if settings.CELERY_ALWAYS_EAGER:
            raise click.ClickException('Disable CELERY_ALWAYS_EAGER in your settings file to spawn workers.')

        daemons += [
            ('worker', ['sentry', 'celery', 'worker', '-c', '1', '-l', 'INFO']),
            ('beat', ['sentry', 'celery', 'beat', '-l', 'INFO']),
        ]

    # A better log-format for local dev when running through honcho,
    # but if there aren't any other daemons, we don't want to override.
    if daemons:
        uwsgi_overrides['log-format'] = '"%(method) %(uri) %(proto)" %(status) %(size)'
    else:
        uwsgi_overrides['log-format'] = '[%(ltime)] "%(method) %(uri) %(proto)" %(status) %(size)'

    server = SentryHTTPServer(host=host, port=port, workers=1, extra_options=uwsgi_overrides)

    # If we don't need any other daemons, just launch a normal uwsgi webserver
    # and avoid dealing with subprocesses
    if not daemons:
        return server.run()

    import sys
    from subprocess import list2cmdline
    from honcho.manager import Manager

    os.environ['PYTHONUNBUFFERED'] = 'true'

    # Make sure that the environment is prepared before honcho takes over
    # This sets all the appropriate uwsgi env vars, etc
    server.prepare_environment()
    daemons += [
        ('server', ['sentry', 'run', 'web']),
    ]

    cwd = os.path.realpath(os.path.join(settings.PROJECT_ROOT, os.pardir, os.pardir))

    manager = Manager()
    for name, cmd in daemons:
        manager.add_process(
            name, list2cmdline(cmd),
            quiet=False, cwd=cwd,
        )

    manager.loop()
    sys.exit(manager.returncode)
