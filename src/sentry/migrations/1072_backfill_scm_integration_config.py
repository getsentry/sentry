import logging

from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.constants import ObjectStatus
from sentry.hybridcloud.rpc.service import RpcRemoteException
from sentry.new_migrations.migrations import CheckedMigration
from sentry.types.cell import CellMappingNotFound
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

logger = logging.getLogger(__name__)

# Maps OrganizationOption key -> (integration provider, OI config key).
# Mirrors the live fan-out write in
# src/sentry/core/endpoints/organization_details.py so the backfill and
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

_LEGACY_KEYS = [opt_key for pairs in _PROVIDER_KEYS.values() for opt_key, _ in pairs]


def _opt_is_true(value: object) -> bool:
    # sentry_organizationoptions.value is jsonb; historical writers stored
    # booleans as JSON true/false, but a few older rows hold ints or string
    # booleans. Normalize the same way the live read path does.
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.lower() in ("true", "1", "t", "yes")
    return bool(value)


def backfill_scm_integration_config(
    apps: StateApps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    # Iterate the legacy OrganizationOption rows on the region silo (only orgs
    # that ever flipped one of the three toggles — a few thousand in prod) and
    # fan out updates to the control-silo OrganizationIntegration via RPC. We
    # skip rows whose value coerces to false — the new read path treats a
    # missing OI config key as false, so those rows are a no-op.
    from sentry.integrations.services.integration import integration_service

    OrganizationOption = apps.get_model("sentry", "OrganizationOption")

    queryset = OrganizationOption.objects.filter(key__in=_LEGACY_KEYS)

    opts_by_org: dict[int, dict[str, bool]] = {}
    for opt in RangeQuerySetWrapperWithProgressBar(queryset):
        if not _opt_is_true(opt.value):
            continue
        opts_by_org.setdefault(opt.organization_id, {})[opt.key] = True

    for organization_id, opts in opts_by_org.items():
        for provider, key_pairs in _PROVIDER_KEYS.items():
            if not any(opt_key in opts for opt_key, _ in key_pairs):
                continue

            try:
                ois = integration_service.get_organization_integrations(
                    organization_id=organization_id,
                    providers=[provider],
                    status=ObjectStatus.ACTIVE,
                )
            except (CellMappingNotFound, RpcRemoteException):
                continue

            for oi in ois:
                config = dict(oi.config or {})
                changed = False
                for opt_key, cfg_key in key_pairs:
                    if opt_key in opts and cfg_key not in config:
                        config[cfg_key] = True
                        changed = True

                if changed:
                    integration_service.update_organization_integration(
                        org_integration_id=oi.id, config=config
                    )


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
