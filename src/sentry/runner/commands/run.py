"""
sentry.runner.commands.run
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import sys
from multiprocessing import cpu_count

import click

from sentry.runner.decorators import configuration, log_options


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

Address = AddressParamType()


class QueueSetType(click.ParamType):
    name = 'text'

    def convert(self, value, param, ctx):
        if value is None:
            return None
        # Providing a compatibility with splitting
        # the `events` queue until multiple queues
        # without the need to explicitly add them.
        queues = set()
        for queue in value.split(','):
            if queue == 'events':
                queues.add('events.preprocess_event')
                queues.add('events.process_event')
                queues.add('events.save_event')

                from sentry.runner.initializer import show_big_error
                show_big_error([
                    'DEPRECATED',
                    '`events` queue no longer exists.',
                    'Switch to using:',
                    '- events.preprocess_event',
                    '- events.process_event',
                    '- events.save_event',
                ])
            else:
                queues.add(queue)
        return frozenset(queues)


QueueSet = QueueSetType()


@click.group()
def run():
    "Run a service."


@run.command()
@click.option('--bind', '-b', default=None, help='Bind address.', type=Address)
@click.option('--workers', '-w', default=0, help='The number of worker processes for handling requests.')
@click.option('--upgrade', default=False, is_flag=True, help='Upgrade before starting.')
@click.option('--with-lock', default=False, is_flag=True, help='Use a lock if performing an upgrade.')
@click.option('--noinput', default=False, is_flag=True, help='Do not prompt the user for input of any kind.')
@log_options()
@configuration
def web(bind, workers, upgrade, with_lock, noinput):
    "Run web service."
    if upgrade:
        click.echo('Performing upgrade before service startup...')
        from sentry.runner import call_command
        try:
            call_command(
                'sentry.runner.commands.upgrade.upgrade',
                verbosity=0, noinput=noinput, lock=with_lock,
            )
        except click.ClickException:
            if with_lock:
                click.echo('!! Upgrade currently running from another process, skipping.', err=True)
            else:
                raise

    from sentry.services.http import SentryHTTPServer
    SentryHTTPServer(
        host=bind[0],
        port=bind[1],
        workers=workers,
    ).run()


@run.command()
@click.option('--bind', '-b', default=None, help='Bind address.', type=Address)
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


@run.command()
@click.option('--hostname', '-n', help=(
    'Set custom hostname, e.g. \'w1.%h\'. Expands: %h'
    '(hostname), %n (name) and %d, (domain).'))
@click.option('--queues', '-Q', type=QueueSet, help=(
    'List of queues to enable for this worker, separated by '
    'comma. By default all configured queues are enabled. '
    'Example: -Q video,image'))
@click.option('--exclude-queues', '-X', type=QueueSet)
@click.option('--concurrency', '-c', default=cpu_count(), help=(
    'Number of child processes processing the queue. The '
    'default is the number of CPUs available on your '
    'system.'))
@click.option('--logfile', '-f', help=(
    'Path to log file. If no logfile is specified, stderr is used.'))
@click.option('--quiet', '-q', is_flag=True, default=False)
@click.option('--no-color', is_flag=True, default=False)
@click.option('--autoreload', is_flag=True, default=False, help='Enable autoreloading.')
@click.option('--without-gossip', is_flag=True, default=False)
@click.option('--without-mingle', is_flag=True, default=False)
@click.option('--without-heartbeat', is_flag=True, default=False)
@click.option('--max-tasks-per-child', default=10000)
@log_options()
@configuration
def worker(**options):
    "Run background worker instance."
    from django.conf import settings
    if settings.CELERY_ALWAYS_EAGER:
        raise click.ClickException('Disable CELERY_ALWAYS_EAGER in your settings file to spawn workers.')

    from sentry.celery import app
    worker = app.Worker(
        # without_gossip=True,
        # without_mingle=True,
        # without_heartbeat=True,
        pool_cls='processes',
        **options
    )
    worker.start()
    try:
        sys.exit(worker.exitcode)
    except AttributeError:
        # `worker.exitcode` was added in a newer version of Celery:
        # https://github.com/celery/celery/commit/dc28e8a5
        # so this is an attempt to be forwards compatible
        pass


@run.command()
@click.option('--pidfile', help=(
    'Optional file used to store the process pid. The '
    'program will not start if this file already exists and '
    'the pid is still alive.'))
@click.option('--logfile', '-f', help=(
    'Path to log file. If no logfile is specified, stderr is used.'))
@click.option('--quiet', '-q', is_flag=True, default=False)
@click.option('--no-color', is_flag=True, default=False)
@click.option('--autoreload', is_flag=True, default=False, help='Enable autoreloading.')
@click.option('--without-gossip', is_flag=True, default=False)
@click.option('--without-mingle', is_flag=True, default=False)
@click.option('--without-heartbeat', is_flag=True, default=False)
@log_options()
@configuration
def cron(**options):
    "Run periodic task dispatcher."
    from django.conf import settings
    if settings.CELERY_ALWAYS_EAGER:
        raise click.ClickException('Disable CELERY_ALWAYS_EAGER in your settings file to spawn workers.')

    from sentry.celery import app
    app.Beat(
        # without_gossip=True,
        # without_mingle=True,
        # without_heartbeat=True,
        **options
    ).run()
