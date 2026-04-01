from __future__ import annotations

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import itertools

import click
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps
from django.db.models import ExpressionWrapper, F
from django.db.models.fields import DateTimeField

from sentry.new_migrations.migrations import CheckedMigration

BATCH_SIZE = 10_000
SENTINEL = datetime(1970, 1, 1, 0, 0, 0, tzinfo=dt_timezone.utc)
DEFAULT_RETENTION_DAYS = 30


def backfill_eventattachment_date_expires(
    apps: StateApps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    EventAttachment = apps.get_model("sentry", "EventAttachment")

    total_updated = 0
    for i in itertools.count():
        batch = EventAttachment.objects.filter(date_expires=SENTINEL).values("id")[:BATCH_SIZE]
        updated = EventAttachment.objects.filter(id__in=batch).update(
            date_expires=ExpressionWrapper(
                F("date_added") + timedelta(days=DEFAULT_RETENTION_DAYS),
                output_field=DateTimeField(),
            )
        )
        if not updated:
            break

        total_updated += updated
        if i % 100 == 0:
            click.echo(f"Backfilled {total_updated} rows so far...")

    click.echo(f"Done. Backfilled {total_updated} rows total.")


class Migration(CheckedMigration):
    # This flag is used to mark that a migration shouldn't be automatically run in production.
    # This should only be used for operations where it's safe to run the migration after your
    # code has deployed. So this should not be used for most operations that alter the schema
    # of a table.
    # Here are some things that make sense to mark as post deployment:
    # - Large data migrations. Typically we want these to be run manually so that they can be
    #   monitored and not block the deploy for a long period of time while they run.
    # - Adding indexes to large tables. Since this can take a long time, we'd generally prefer to
    #   run this outside deployments so that we don't block them. Note that while adding an index
    #   is a schema change, it's completely safe to run the operation after the code has deployed.
    # Once deployed, run these manually via: https://develop.sentry.dev/database-migrations/#migration-deployment

    is_post_deployment = True

    dependencies = [
        ("sentry", "1061_eventattachment_date_expires_index"),
    ]

    operations = [
        migrations.RunPython(
            backfill_eventattachment_date_expires,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_eventattachment"]},
        ),
    ]
