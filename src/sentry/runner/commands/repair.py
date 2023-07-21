import os
from contextlib import contextmanager

import click
from django.db import transaction

from sentry.runner.decorators import configuration
from sentry.services.hybrid_cloud.util import region_silo_function
from sentry.silo.base import SiloLimit
from sentry.types.activity import ActivityType


class RollbackLocally(Exception):
    pass


@contextmanager
def catchable_atomic():
    try:
        with transaction.atomic("default"):
            yield
    except RollbackLocally:
        pass


def sync_docs():
    click.echo("Forcing documentation sync")
    from sentry.utils.integrationdocs import DOC_FOLDER, sync_docs

    if os.access(DOC_FOLDER, os.W_OK):
        try:
            sync_docs()
        except Exception as e:
            click.echo(" - skipping, failure: %s" % e)
    elif os.path.isdir(DOC_FOLDER):
        click.echo(" - skipping, path cannot be written to: %r" % DOC_FOLDER)
    else:
        click.echo(" - skipping, path does not exist: %r" % DOC_FOLDER)


@region_silo_function
def create_missing_dsns():
    from sentry.models import Project, ProjectKey

    click.echo("Creating missing DSNs")
    queryset = Project.objects.filter(key_set__isnull=True)
    for project in queryset:
        try:
            ProjectKey.objects.get_or_create(project=project)
        except ProjectKey.MultipleObjectsReturned:
            pass


@region_silo_function
def fix_group_counters():
    from django.db import connection

    click.echo("Correcting Group.num_comments counter")
    cursor = connection.cursor()
    cursor.execute(
        """
        UPDATE sentry_groupedmessage SET num_comments = (
            SELECT COUNT(*) from sentry_activity
            WHERE type = %s and group_id = sentry_groupedmessage.id
        )
    """,
        [ActivityType.NOTE.value],
    )


@click.command()
@click.option(
    "--with-docs/--without-docs",
    default=False,
    help="Synchronize and repair embedded documentation. This " "is disabled by default.",
)
@configuration
def repair(with_docs):
    """Attempt to repair any invalid data.

    This by default will correct some common issues like projects missing
    DSNs or counters desynchronizing.  Optionally it can also synchronize
    the current client documentation from the Sentry documentation server
    (--with-docs).
    """

    if with_docs:
        sync_docs()

    try:
        create_missing_dsns()
        fix_group_counters()
    except SiloLimit.AvailabilityError:
        click.echo("Skipping repair operations due to silo restrictions")
        pass
