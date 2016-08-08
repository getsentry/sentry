"""
sentry.runner.commands.repair
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import os
import click
import six

from contextlib import contextmanager
from django.db import transaction

from sentry.runner.decorators import configuration
from sentry.utils.strings import iter_callsign_choices


class RollbackLocally(Exception):
    pass


@contextmanager
def catchable_atomic():
    try:
        with transaction.atomic():
            yield
    except RollbackLocally:
        pass


def get_callsigns(projects):
    rv = {}

    for project in projects:
        if project.callsign is not None:
            rv[project.callsign] = project.id
            continue
        for callsign in iter_callsign_choices(project.name):
            if callsign in rv:
                continue
            rv[callsign] = project.id
            break

    return dict((v, k) for k, v in six.iteritems(rv))


def sync_docs():
    click.echo('Forcing documentation sync')
    from sentry.utils.integrationdocs import sync_docs, DOC_FOLDER
    if os.access(DOC_FOLDER, os.W_OK):
        try:
            sync_docs()
        except Exception as e:
            click.echo(' - skipping, failure: %s' % e)
    elif os.path.isdir(DOC_FOLDER):
        click.echo(' - skipping, path cannot be written to: %r' % DOC_FOLDER)
    else:
        click.echo(' - skipping, path does not exist: %r' % DOC_FOLDER)


def repair_callsigns():
    from sentry.utils.query import RangeQuerySetWrapperWithProgressBar, \
        RangeQuerySetWrapper
    from sentry.models.counter import increment_project_counter
    from sentry.models import Organization, Group, Project, ProjectOption

    click.echo('Repairing callsigns')

    queryset = Organization.objects.all()

    for org in RangeQuerySetWrapperWithProgressBar(queryset):
        projects = list(org.project_set.all())
        callsigns = get_callsigns(projects)
        for project in projects:
            if project.callsign is None:
                Project.objects.filter(
                    pk=project.id,
                    callsign=None
                ).update(callsign=callsigns[project.id])
                ProjectOption.objects.filter(
                    project=project,
                    key='sentry:reviewed-callsign'
                ).delete()
            q = Group.objects.filter(
                project=project,
                short_id=None,
            )
            for group in RangeQuerySetWrapper(q):
                with catchable_atomic():
                    pending_short_id = increment_project_counter(
                        project)
                    updated = Group.objects.filter(
                        pk=group.id,
                        short_id=None
                    ).update(short_id=pending_short_id)
                    if updated == 0:
                        raise RollbackLocally()


def create_missing_dsns():
    from sentry.models import Project, ProjectKey
    click.echo('Creating missing DSNs')
    queryset = Project.objects.filter(key_set__isnull=True)
    for project in queryset:
        try:
            ProjectKey.objects.get_or_create(
                project=project,
            )
        except ProjectKey.MultipleObjectsReturned:
            pass


def fix_group_counters():
    from sentry.models import Activity
    from django.db import connection
    click.echo('Correcting Group.num_comments counter')
    cursor = connection.cursor()
    cursor.execute("""
        UPDATE sentry_groupedmessage SET num_comments = (
            SELECT COUNT(*) from sentry_activity
            WHERE type = %s and group_id = sentry_groupedmessage.id
        )
    """, [Activity.NOTE])


@click.command()
@click.option('--with-docs/--without-docs', default=False,
              help='Synchronize and repair embedded documentation. This '
              'is disabled by default.')
@click.option('--with-callsigns/--without-callsigns', default=False,
              help='Repair and fill callsigns. This is disabled by default.')
@configuration
def repair(with_docs, with_callsigns):
    """Attempt to repair any invalid data.

    This by default will correct some common issues like projects missing
    DSNs or counters desynchronizing.  Optionally it can also synchronize
    the current client documentation from the Sentry documentation server
    (--with-docs) and repair missing or broken callsigns and short IDs
    (--with-callsigns).
    """

    if with_docs:
        sync_docs()

    if with_callsigns:
        repair_callsigns()

    create_missing_dsns()
    fix_group_counters()
