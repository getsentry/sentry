import logging
from collections import defaultdict

from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.constants import ObjectStatus
from sentry.new_migrations.migrations import CheckedMigration

logger = logging.getLogger(__name__)

# Maps integration provider -> list of (OrganizationOption key, OI config key)
# pairs. Mirrors the live fan-out write in
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


def backfill_scm_integration_config(
    apps: StateApps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    """
    Iterate the legacy OrganizationOption rows on the region silo (only orgs
    that ever flipped one of the three toggles — a few thousand in prod) and
    fan out updates to the control-silo OrganizationIntegration via RPC.

    We only consider rows whose value is exactly True; the new read path
    treats a missing OI config key as false, so any other shape is a no-op.
    """
    # Imports are deferred so that breakage in these modules surfaces
    # at runtime (when this migration is replayed on a fresh DB),
    # not at migration-plan resolution time for every `migrate`.
    #
    # The bigger risk isn't the symbol surface, though -- it's that
    # `integration_service` reads and writes the live
    # `sentry_organizationintegration` table, not the historical
    # snapshot we'd get via `apps.get_model`. If that table's schema
    # or the meaning of `config` changes in a way this backfill's
    # payload doesn't account for, replays on fresh self-hosted DBs
    # will misbehave. We accept that: if/when it happens, this
    # migration body is noop'd. By then getsentry prod and most
    # self-hosted installs will already have run it; the residual
    # risk is a small set of self-hosted users on a very old version
    # with one of the legacy toggles set to true, who upgrade past
    # the noop and don't get those toggles carried over to the
    # per-OI config. That's preferable to keeping the OI table
    # frozen indefinitely.
    #
    # We considered using a new outbox category to drive the
    # cross-silo write instead. That doesn't actually remove the
    # risk, it just relocates it onto the outbox tables: the live
    # worker still dispatches against the current
    # `sentry_organizationintegration` schema, and our rows would be
    # tagged with a category enum entry that future code may retire
    # -- leaving un-migrated installs with outbox rows the worker
    # can't decode. Same cleanup shape (noop the migration body),
    # with extra plumbing (category enum, signal receiver, drain
    # semantics) and no real decoupling. The RPC path is also
    # synchronous and observable, which is what an operator running
    # a post-deploy migration wants.
    from sentry.hybridcloud.rpc.service import RpcRemoteException
    from sentry.integrations.services.integration import integration_service
    from sentry.types.cell import CellMappingNotFound

    OrganizationOption = apps.get_model("sentry", "OrganizationOption")

    queryset = OrganizationOption.objects.filter(key__in=_LEGACY_KEYS, value=True)

    opts_by_org: defaultdict[int, set[str]] = defaultdict(set)
    for opt in queryset:
        opts_by_org[opt.organization_id].add(opt.key)

    # For each org with at least one true-valued legacy option, find the
    # ACTIVE OIs of each provider that owns one of the matching keys.
    for organization_id, opts in opts_by_org.items():
        for provider, key_pairs in _PROVIDER_KEYS.items():
            # Skip providers whose owned keys aren't set on this org. e.g.
            # if only sentry:gitlab_pr_bot is true, don't bother RPC-listing
            # the github OIs.
            if not any(opt_key in opts for opt_key, _ in key_pairs):
                continue

            try:
                ois = integration_service.get_organization_integrations(
                    organization_id=organization_id,
                    providers=[provider],
                    status=ObjectStatus.ACTIVE,
                )
            except (CellMappingNotFound, RpcRemoteException):
                logger.exception(
                    "scm_backfill.list_failed",
                    extra={
                        "organization_id": organization_id,
                        "provider": provider,
                    },
                )
                continue

            # An org can have multiple ACTIVE installs of the same provider
            # (multi-org GitHub apps); each gets its own per-install config.
            for oi in ois:
                config = dict(oi.config or {})
                set_keys: list[str] = []
                # Backfill every owned key that's true on the org and not
                # already present on the OI. Keys already set are left
                # alone — the per-install UI may have set them explicitly.
                for opt_key, cfg_key in key_pairs:
                    if opt_key in opts and cfg_key not in config:
                        config[cfg_key] = True
                        set_keys.append(cfg_key)

                if set_keys:
                    # Exceptions from the write are deliberately uncaught: if
                    # this fails we want the migration to abort loudly so an
                    # operator can investigate, rather than silently dropping
                    # a true toggle on the floor and leaving an org with the
                    # wrong setting.
                    integration_service.update_organization_integration(
                        org_integration_id=oi.id, config=config
                    )
                    logger.info(
                        "scm_backfill.set",
                        extra={
                            "organization_id": organization_id,
                            "org_integration_id": oi.id,
                            "provider": provider,
                            "keys": set_keys,
                        },
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
