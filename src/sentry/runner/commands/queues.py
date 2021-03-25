import click

from sentry.runner.decorators import configuration


@click.group()
def queues():
    "Manage Sentry queues."


@queues.command()
@click.option("-S", "sort_size", default=False, is_flag=True, help="Sort by size.")
@click.option("-r", "reverse", default=False, is_flag=True, help="Reverse the sort order.")
@configuration
def list(sort_size, reverse):
    "List queues and their sizes."

    from django.conf import settings

    from sentry.monitoring.queues import backend

    if backend is None:
        raise click.ClickException("unknown broker type")

    queues = backend.bulk_get_sizes([q.name for q in settings.CELERY_QUEUES])

    if sort_size:
        queues = sorted(queues, key=lambda q: (-q[1], q[0]), reverse=reverse)
    else:
        queues = sorted(queues, reverse=reverse)

    for queue in queues:
        click.echo("%s %d" % queue)


@queues.command()
@click.option("-f", "--force", default=False, is_flag=True, help="Do not prompt for confirmation.")
@click.argument("queue")
@configuration
def purge(force, queue):
    "Purge all messages from a queue."

    from sentry.monitoring.queues import backend, get_queue_by_name

    if get_queue_by_name(queue) is None:
        raise click.ClickException("unknown queue: %r" % queue)

    if backend is None:
        raise click.ClickException("unknown broker type")

    size = backend.get_size(queue)

    if size == 0:
        click.echo("Queue is empty, nothing to purge", err=True)
        return

    if not force:
        click.confirm(
            "Are you sure you want to purge %d messages from the queue '%s'?" % (size, queue),
            abort=True,
        )

    click.echo("Poof, %d messages deleted" % backend.purge_queue(queue), err=True)
