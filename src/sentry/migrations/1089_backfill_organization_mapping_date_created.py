from typing import Any

from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration

# Hardcoded values from sentry.hybridcloud.outbox.category at the time this
# migration was authored. Pinned as integers so a future enum/scope rename
# can't break replays on stale databases.
_ORGANIZATION_SCOPE = 0
_ORGANIZATION_UPDATE = 2

_BATCH_SIZE = 1000


def backfill_organization_mapping_date_created(
    apps: StateApps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    """
    Emit one cell outbox per Organization to re-replicate the mapping row
    with the now-plumbed date_created (= Organization.date_added). The
    standard Organization receiver calls handle_async_replication, which
    calls update_organization_mapping_from_instance and upserts via the
    organization_mapping RPC. Before #115325, OrganizationMapping.date_created
    held a fresh timezone.now() captured at mapping insert time rather than
    Organization.date_added; the org listing UI (moving to control) reads
    this column to filter audit logs.

    The outbox-emit pattern mirrors 1072_backfill_scm_integration_config:
    draining happens in a worker with a stable RPC auth context, retries on
    transient failure, and runs in current code -- so a replay against
    drifted code is at worst a no-op rather than a half-applied write.
    """
    Organization = apps.get_model("sentry", "Organization")
    CellOutbox = apps.get_model("sentry", "CellOutbox")

    batch: list[Any] = []
    for org_id in Organization.objects.values_list("id", flat=True).iterator(
        chunk_size=_BATCH_SIZE
    ):
        batch.append(
            CellOutbox(
                shard_scope=_ORGANIZATION_SCOPE,
                shard_identifier=org_id,
                category=_ORGANIZATION_UPDATE,
                object_identifier=org_id,
            )
        )
        if len(batch) >= _BATCH_SIZE:
            CellOutbox.objects.bulk_create(batch)
            batch = []

    if batch:
        CellOutbox.objects.bulk_create(batch)


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
        ("sentry", "1087_add_projectrepository"),
    ]

    operations = [
        migrations.RunPython(
            backfill_organization_mapping_date_created,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_organization", "sentry_regionoutbox"]},
        ),
    ]
