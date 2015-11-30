"""
sentry.runner.commands.cleanup
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import click
from sentry.runner.decorators import configuration


@click.command()
@click.option('--days', default=30, type=int, show_default=True, help='Numbers of days to truncate on.')
@click.option('--project', type=int, help='Limit truncation to only entries from project.')
@click.option('--concurrency', type=int, default=1, show_default=True, help='The number of concurrent workers to run.')
@configuration
def cleanup(days, project, concurrency):
    "Delete a portion of trailing data based on creation date."

    from datetime import timedelta
    from django.utils import timezone

    from sentry.app import nodestore
    from sentry.db.deletion import BulkDeleteQuery
    from sentry.models import (
        Event, EventMapping, Group, GroupRuleStatus, GroupTagValue,
        LostPasswordHash, TagValue, GroupEmailThread,
    )

    # these models should be safe to delete without cascades, in order
    BULK_DELETES = (
        (GroupRuleStatus, 'date_added'),
        (GroupTagValue, 'last_seen'),
        (TagValue, 'last_seen'),
        (GroupEmailThread, 'date'),
    )

    GENERIC_DELETES = (
        (Event, 'datetime'),
        (Group, 'last_seen'),
    )

    click.echo("Removing expired values for LostPasswordHash")
    LostPasswordHash.objects.filter(
        date_added__lte=timezone.now() - timedelta(hours=48)
    ).delete()

    if project:
        click.echo("Bulk NodeStore deletion not available for project selection", err=True)
    else:
        click.echo("Removing old NodeStore values")
        cutoff = timezone.now() - timedelta(days=days)
        try:
            nodestore.cleanup(cutoff)
        except NotImplementedError:
            click.echo("NodeStore backend does not support cleanup operation", err=True)

    for model, dtfield in BULK_DELETES:
        click.echo("Removing {model} for days={days} project={project}".format(
            model=model.__name__,
            days=days,
            project=project or '*',
        ))
        BulkDeleteQuery(
            model=model,
            dtfield=dtfield,
            days=days,
            project_id=project,
        ).execute()

    # EventMapping is fairly expensive and is special cased as it's likely you
    # won't need a reference to an event for nearly as long
    click.echo("Removing expired values for EventMapping")
    BulkDeleteQuery(
        model=EventMapping,
        dtfield='date_added',
        days=min(days, 7),
        project_id=project,
    ).execute()

    for model, dtfield in GENERIC_DELETES:
        click.echo("Removing {model} for days={days} project={project}".format(
            model=model.__name__,
            days=days,
            project=project or '*',
        ))
        BulkDeleteQuery(
            model=model,
            dtfield=dtfield,
            days=days,
            project_id=project,
        ).execute_generic()
