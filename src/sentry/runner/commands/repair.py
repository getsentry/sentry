"""
sentry.runner.commands.repair
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import os
import click
from sentry.runner.decorators import configuration


@click.command()
@configuration
def repair():
    "Attempt to repair any invalid data."

    click.echo('Forcing documentation sync')
    from sentry.utils.integrationdocs import sync_docs, DOC_FOLDER
    if os.access(DOC_FOLDER, os.W_OK):
        sync_docs()
    else:
        click.echo(' - skipping (path cannot be written to)')

    from sentry.models import Activity, Project, ProjectKey
    click.echo('Creating missing project keys')
    queryset = Project.objects.filter(key_set__isnull=True)
    for project in queryset:
        try:
            ProjectKey.objects.get_or_create(
                project=project,
            )
        except ProjectKey.MultipleObjectsReturned:
            pass

    from django.db import connection
    click.echo("Correcting Group.num_comments counter")
    cursor = connection.cursor()
    cursor.execute("""
        UPDATE sentry_groupedmessage SET num_comments = (
            SELECT COUNT(*) from sentry_activity
            WHERE type = %s and group_id = sentry_groupedmessage.id
        )
    """, [Activity.NOTE])
