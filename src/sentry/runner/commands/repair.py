from collections.abc import Generator
from contextlib import contextmanager

import click
from django.db import transaction

from sentry.runner.decorators import configuration
from sentry.silo.base import SiloLimit, region_silo_function
from sentry.types.activity import ActivityType


class RollbackLocally(Exception):
    pass


@contextmanager
def catchable_atomic() -> Generator[None]:
    try:
        with transaction.atomic("default"):
            yield
    except RollbackLocally:
        pass


@region_silo_function
def create_missing_dsns() -> None:
    from sentry.models.project import Project
    from sentry.models.projectkey import ProjectKey

    click.echo("Creating missing DSNs")
    queryset = Project.objects.filter(key_set__isnull=True)
    for project in queryset:
        try:
            ProjectKey.objects.get_or_create(project=project)
        except ProjectKey.MultipleObjectsReturned:
            pass


@region_silo_function
def fix_group_counters() -> None:
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
@configuration
def repair() -> None:
    """Attempt to repair any invalid data.

    This by default will correct some common issues like projects missing
    DSNs or counters desynchronizing.
    """

    try:
        create_missing_dsns()
        fix_group_counters()
    except SiloLimit.AvailabilityError:
        click.echo("Skipping repair operations due to silo restrictions")
