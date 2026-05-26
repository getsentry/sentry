from collections import defaultdict

from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration

# Legacy OrganizationOption keys whose value=True needs to be carried onto
# OrganizationIntegration.config. Mirrors _SCM_BACKFILL_PROVIDER_KEYS in
# src/sentry/receivers/outbox/cell.py.
_LEGACY_KEYS = (
    "sentry:github_pr_bot",
    "sentry:github_nudge_invite",
    "sentry:gitlab_pr_bot",
)

# Hardcoded values from sentry.hybridcloud.outbox.category at the time this
# migration was authored. Pinned as integers so a future enum/scope rename
# can't break replays on stale databases.
_ORGANIZATION_SCOPE = 0
_SCM_INTEGRATION_CONFIG_BACKFILL = 46


def backfill_scm_integration_config(
    apps: StateApps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    """
    Emit one cell outbox per org with at least one true-valued legacy SCM
    toggle. The receiver (sentry.receivers.outbox.cell) drains each outbox
    on the cell silo and fans out to every ACTIVE GitHub/GitLab
    OrganizationIntegration via RPC.

    The previous body did the RPC directly from the migration CLI and
    failed in prod with 401 errors against the control silo. Outboxes
    drain inside a worker that has a stable RPC auth context, retry on
    transient failures, and run in current code -- so a replay against
    drifted code is at worst a no-op (the receiver may be retired) rather
    than a half-applied write.
    """
    OrganizationOption = apps.get_model("sentry", "OrganizationOption")
    CellOutbox = apps.get_model("sentry", "CellOutbox")

    queryset = OrganizationOption.objects.filter(key__in=_LEGACY_KEYS, value=True)

    opts_by_org: defaultdict[int, set[str]] = defaultdict(set)
    for opt in queryset:
        opts_by_org[opt.organization_id].add(opt.key)

    for organization_id, opts in opts_by_org.items():
        CellOutbox(
            shard_scope=_ORGANIZATION_SCOPE,
            shard_identifier=organization_id,
            category=_SCM_INTEGRATION_CONFIG_BACKFILL,
            object_identifier=organization_id,
            payload={"keys": sorted(opts)},
        ).save()


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
        ("sentry", "1071_add_broadcast_sync_locked"),
    ]

    operations = [
        migrations.RunPython(
            backfill_scm_integration_config,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_organizationoptions"]},
        ),
    ]
