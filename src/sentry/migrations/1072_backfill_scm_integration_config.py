import logging

from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.constants import ObjectStatus
from sentry.hybridcloud.rpc.service import RpcRemoteException
from sentry.models.organization import Organization
from sentry.new_migrations.migrations import CheckedMigration
from sentry.types.cell import CellMappingNotFound
from sentry.utils.query import RangeQuerySetWrapperWithProgressBarApprox

logger = logging.getLogger(__name__)

# Maps OrganizationOption key -> (integration provider, OI config key).
# Mirrors the mapping used by the live fan-out write in
# src/sentry/core/endpoints/organization_details.py so a backfill and
# any newly installed OI end up consistent.
_PROVIDER_KEYS = {
    "github": [
        ("sentry:github_pr_bot", "pr_comments"),
        ("sentry:github_nudge_invite", "nudge_invite"),
    ],
    "gitlab": [
        ("sentry:gitlab_pr_bot", "pr_comments"),
    ],
}


def backfill_scm_integration_config(
    apps: StateApps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    # `sentry_organizationintegration` is control-silo; `sentry_organizationoptions`
    # is region-silo. This migration is routed to control via the `tables` hint
    # below, so we read OI rows locally but fetch the legacy option values over
    # the cell RPC instead of a cross-silo SQL query (which is impossible).
    from sentry.organizations.services.organization import organization_service

    OrganizationIntegration = apps.get_model("sentry", "OrganizationIntegration")

    # Iterate the whole OI table — the approx wrapper needs an unfiltered
    # queryset, and we don't have an index on (status, id) or
    # (integration_id, id) for a filtered range scan. Filtering in Python
    # is cheaper than either alternative.
    queryset = OrganizationIntegration.objects.all().select_related("integration")

    option_cache: dict[tuple[int, str], object] = {}

    for oi in RangeQuerySetWrapperWithProgressBarApprox(queryset):
        if oi.status != ObjectStatus.ACTIVE:
            continue
        provider = oi.integration.provider
        key_pairs = _PROVIDER_KEYS.get(provider)
        if not key_pairs:
            continue

        config = dict(oi.config or {})
        changed = False
        for opt_key, cfg_key in key_pairs:
            if cfg_key in config:
                continue
            cache_key = (oi.organization_id, opt_key)
            if cache_key not in option_cache:
                try:
                    option_cache[cache_key] = organization_service.get_option(
                        organization_id=oi.organization_id, key=opt_key
                    )
                except (Organization.DoesNotExist, CellMappingNotFound, RpcRemoteException):
                    # OI references an org that's already been deleted on the
                    # region silo. The HybridCloudForeignKey cascade is async
                    # across silos so this window is expected. In monolith /
                    # tests the region raises Organization.DoesNotExist; in
                    # split-silo the cell resolver raises CellMappingNotFound
                    # (mapping gone) or RpcRemoteException (mapping intact,
                    # region-side DoesNotExist wrapped by the RPC framework).
                    option_cache[cache_key] = None
            value = option_cache[cache_key]
            if value is None:
                continue
            config[cfg_key] = bool(value)
            changed = True

        if changed:
            oi.config = config
            oi.save(update_fields=["config"])


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
            hints={"tables": ["sentry_organizationintegration"]},
        ),
    ]
