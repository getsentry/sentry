"""
sentry.runner.commands.devserver
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import click
import six

from sentry.runner.decorators import configuration, log_options


@click.command()
@click.option('--reload/--no-reload', default=True, help='Autoreloading of python files.')
@click.option('--watchers/--no-watchers', default=True, help='Watch static files and recompile on changes.')
@click.option('--workers/--no-workers', default=False, help='Run asynchronous workers.')
@click.argument('bind', default='127.0.0.1:8000', metavar='ADDRESS')
@log_options()
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
    from sentry import options
    from sentry.services.http import SentryHTTPServer

    url_prefix = options.get('system.url-prefix', '')
    needs_https = url_prefix.startswith('https://')
    has_https = False

    if needs_https:
        from subprocess import check_output
        try:
            check_output(['which', 'https'])
            has_https = True
        except Exception:
            has_https = False
            from sentry.runner.initializer import show_big_error
            show_big_error([
                'missing `https` on your `$PATH`, but https is needed',
                '`$ brew install mattrobenolt/stuff/https`',
            ])

    uwsgi_overrides = {
        # Make sure we don't try and use uwsgi protocol
        'protocol': 'http',
        # Make sure we reload really quickly for local dev in case it
        # doesn't want to shut down nicely on it's own, NO MERCY
        'worker-reload-mercy': 2,
        # We need stdin to support pdb in devserver
        'honour-stdin': True,
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
            ('worker', ['sentry', 'run', 'worker', '-c', '1', '--autoreload']),
            ('cron', ['sentry', 'run', 'cron', '--autoreload']),
        ]

    if needs_https and has_https:
        from six.moves.urllib.parse import urlparse
        parsed_url = urlparse(url_prefix)
        https_port = six.text_type(parsed_url.port or 443)
        https_host = parsed_url.hostname

        # Determine a random port for the backend http server
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((host, 0))
        port = s.getsockname()[1]
        s.close()
        bind = '%s:%d' % (host, port)

        daemons += [
            ('https', ['https', '-host', https_host, '-listen', host + ':' + https_port, bind]),
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
