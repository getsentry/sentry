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
@click.pass_context
def devserver(ctx, reload, watchers, workers, bind):
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

    # Make sure we don't try and use uwsgi protocol
    settings.SENTRY_WEB_OPTIONS['protocol'] = 'http'

    # A better log-format for local dev
    settings.SENTRY_WEB_OPTIONS['log-format'] = '[%(ltime)] "%(method) %(uri) %(proto)" %(status) %(size) "%(referer)" "%(uagent)"'

    if reload:
        settings.SENTRY_WEB_OPTIONS['py-autoreload'] = 1

    daemons = []

    if watchers:
        daemons += settings.SENTRY_WATCHERS

    if workers:
        if settings.CELERY_ALWAYS_EAGER:
            raise click.ClickException('Disable CELERY_ALWAYS_EAGER in your settings file to spawn workers.')

        daemons += [
            ['sentry', 'celery', 'worker', '-l', 'INFO'],
            ['sentry', 'celery', 'beat', '-l', 'INFO'],
        ]

    cwd = os.path.realpath(os.path.join(settings.PROJECT_ROOT, os.pardir, os.pardir))

    daemon_list = []
    server = None
    try:
        if daemons:
            import os
            from subprocess import Popen
            env = os.environ.copy()
            for daemon in daemons:
                click.secho('*** Running: {0}'.format(' '.join([os.path.basename(daemon[0])] + daemon[1:])), bold=True)
                try:
                    daemon_list.append(Popen(daemon, cwd=cwd, env=env))
                except OSError:
                    raise click.ClickException('{0} not found.'.format(daemon[0]))

        click.secho('*** Launching webserver..', bold=True)
        server = SentryHTTPServer(
            host=host,
            port=port,
            workers=1,
        ).run_subprocess(cwd=cwd)
        server.wait()
    finally:
        if server and server.poll() is None:
            server.terminate()

            if server.poll() is None:
                server.kill()

        for daemon in daemon_list:
            if daemon.poll() is None:
                daemon.terminate()

        for daemon in daemon_list:
            if daemon.poll() is None:
                daemon.wait()
