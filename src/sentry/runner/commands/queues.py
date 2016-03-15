"""
sentry.runner.commands.queues
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import click
from sentry.runner.decorators import configuration


@click.group()
def queues():
    "Manage Sentry queues."


@queues.command()
@click.option('-S', 'sort_size', default=False, is_flag=True, help='Sort by size.')
@click.option('-r', 'reverse', default=False, is_flag=True, help='Reverse the sort order.')
@configuration
def list(sort_size, reverse):
    "List queues."

    from sentry.celery import app
    from sentry.monitoring.queues import get_backend_for_celery

    try:
        backend = get_backend_for_celery(app)
    except KeyError as e:
        raise click.ClickException('unknown broker type: %r' % e.message)

    queues = backend.bulk_get_sizes(app.conf.CELERY_QUEUES)

    if sort_size:
        queues = sorted(queues, key=lambda q: (-q[1], q[0]), reverse=reverse)
    else:
        queues = sorted(queues, reverse=reverse)

    for queue in queues:
        click.echo('%s %d' % queue)


@queues.command()
@click.option('-f', '--force', default=False, is_flag=True, help='Do not prompt for confirmation.')
@click.argument('queue')
@configuration
def purge(force, queue):
    from sentry.celery import app
    for q in app.conf.CELERY_QUEUES:
        if q.name == queue:
            queue = q
            break
    else:
        raise click.ClickException('unknown queue: %r' % queue)

    from sentry.monitoring.queues import get_backend_for_celery

    try:
        backend = get_backend_for_celery(app)
    except KeyError as e:
        raise click.ClickException('unknown broker type: %r' % e.message)

    size = backend.get_size(queue)

    if size == 0:
        click.echo('Queue is empty, nothing to purge', err=True)
        return

    if not force:
        click.confirm('Are you sure you want to purge %d messages from the queue %r?' % (size, queue.name), abort=True)

    click.echo('Poof, %d messages deleted' % backend.purge_queue(queue), err=True)
