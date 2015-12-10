"""
sentry.runner.commands.cleanup
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import click
from sentry.runner.decorators import configuration


def get_project(value):
    from sentry.models import Project

    try:
        if value.isdigit():
            return int(value)
        if '/' not in value:
            return None
        org, proj = value.split('/', 1)
        return Project.objects.get_from_cache(
            organization__slug=org,
            slug=proj,
        ).id
    except Project.DoesNotExist:
        return None


@click.command()
@click.option('--days', default=30, type=int, show_default=True, help='Numbers of days to truncate on.')
@click.option('--project', help='Limit truncation to only entries from project.')
@click.option('--concurrency', type=int, default=1, show_default=True, help='The number of concurrent workers to run.')
@configuration
def cleanup(days, project, concurrency):
    """Delete a portion of trailing data based on creation date.

    All data that is older than `--days` will be deleted.  The default for
    this is 30 days.  In the default setting all projects will be truncated
    but if you have a specific project you want to limit this to this can be
    done with the `--project` flag which accepts a project ID or a string
    with the form `org/project` where both are slugs.
    """

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

    project_id = None
    if project:
        click.echo("Bulk NodeStore deletion not available for project selection", err=True)
        project_id = get_project(project)
        if project_id is None:
            click.echo('Error: Project not found', err=True)
            raise click.Abort()
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
            project_id=project_id,
        ).execute()

    # EventMapping is fairly expensive and is special cased as it's likely you
    # won't need a reference to an event for nearly as long
    click.echo("Removing expired values for EventMapping")
    BulkDeleteQuery(
        model=EventMapping,
        dtfield='date_added',
        days=min(days, 7),
        project_id=project_id,
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
            project_id=project_id,
        ).execute_generic()
