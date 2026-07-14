"""
This module contains signal handlers for cell outbox messages.

These receivers are triggered on the cell silo as outbox messages
are drained. Receivers are expected to make local state changes (tombstones)
and perform RPC calls to propagate changes to Control Silo.
"""

from __future__ import annotations

import json  # noqa: S003 - urllib3 raises stdlib JSONDecodeError, not simplejson's
import logging
from typing import Any, assert_never, cast

from django.db import IntegrityError, router, transaction
from django.dispatch import receiver

from sentry.audit_log.services.log import AuditLogEvent, UserIpEvent, log_rpc_service
from sentry.auth.services.auth import auth_service
from sentry.auth.services.orgauthtoken import orgauthtoken_rpc_service
from sentry.constants import ObjectStatus, SentryAppInstallationStatus
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.hybridcloud.outbox.signals import process_cell_outbox
from sentry.hybridcloud.services.organization_mapping import organization_mapping_service
from sentry.hybridcloud.services.organization_mapping.model import CustomerId
from sentry.hybridcloud.services.organization_mapping.serial import (
    update_organization_mapping_from_instance,
)
from sentry.integrations.services.integration import integration_service
from sentry.issues.action_log.types import GroupActionLogPayload
from sentry.issues.derived.processing import ProcessingStrategy, trigger_group_log_processing
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.authproviderreplica import AuthProviderReplica
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.receivers.outbox import maybe_process_tombstone
from sentry.seer.agent.client import (
    _trigger_explorer_indexes_if_needed,
    get_available_monitoring_providers,
    get_monitoring_provider_connections,
)
from sentry.seer.agent.client_utils import (
    AgentChatRequest,
    SeerFeatureRunWireRequest,
    make_agent_chat_request,
    make_feature_run_request,
)
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.seer.signed_seer_api import SearchAgentStartRequest, make_search_agent_start_request
from sentry.sentry_apps.services.app.service import app_service
from sentry.types.cell import get_local_cell
from sentry.utils.env import in_test_environment
from sentry.workflow_engine.models import Action

logger = logging.getLogger(__name__)


@receiver(process_cell_outbox, sender=OutboxCategory.SENTRY_APP_NORMALIZE_ACTIONS)
def update_sentry_app_action_data(
    shard_identifier: int,
    object_identifier: int,
    **kwds: Any,
):
    try:
        action = Action.objects.get(
            id=shard_identifier,
            type=Action.Type.SENTRY_APP,
        )
        installs = app_service.get_many(
            filter={
                "uuids": [action.config.get("target_identifier")],
                "status": SentryAppInstallationStatus.INSTALLED,
            }
        )
        if len(installs) > 1:
            # XXX: we don't actually expect this to happen, but since get_many could return more than one we should check
            logger.info(
                "Multiple sentry app installations found",
                extra={
                    "action_id": action.id,
                    "installation_uuid": action.config.get("target_identifier"),
                },
            )
            return

        if not installs:
            logger.info(
                "No sentry app installation found, deleting the action",
                extra={
                    "action_id": action.id,
                    "installation_uuid": action.config.get("target_identifier"),
                },
            )
            action.delete()
            return

        action.config["target_identifier"] = str(installs[0].sentry_app.id)
        action.save()

    except Action.DoesNotExist:
        logger.info("Could not update Action", extra={"action_id": shard_identifier})


# Maps integration provider -> list of (legacy OrganizationOption key, OI
# config key) pairs used by the SCM_INTEGRATION_CONFIG_BACKFILL receiver.
_SCM_BACKFILL_PROVIDER_KEYS: dict[str, list[tuple[str, str]]] = {
    "github": [
        ("sentry:github_pr_bot", "pr_comments"),
        ("sentry:github_nudge_invite", "nudge_invite"),
    ],
    "gitlab": [
        ("sentry:gitlab_pr_bot", "pr_comments"),
    ],
}


@receiver(process_cell_outbox, sender=OutboxCategory.SCM_INTEGRATION_CONFIG_BACKFILL)
def backfill_scm_integration_config(shard_identifier: int, payload: Any, **kwds: Any) -> None:
    """
    Carry legacy `OrganizationOption`-backed SCM toggles onto each ACTIVE
    GitHub/GitLab `OrganizationIntegration.config` for an org. The
    sentry/migrations/1072_backfill_scm_integration_config migration emits
    one cell outbox per affected org with `payload={"keys": [...]}` listing
    the legacy option keys whose value is True.

    The receiver runs on the cell silo so it can issue an authenticated RPC
    to the control silo (which the migration CLI cannot do reliably). Any
    RPC failure propagates to the outbox runner, which retries the outbox
    on its own schedule -- no toggle is silently dropped.
    """
    organization_id = shard_identifier
    keys: set[str] = set((payload or {}).get("keys", []))
    if not keys:
        return

    for provider, key_pairs in _SCM_BACKFILL_PROVIDER_KEYS.items():
        # Skip providers whose owned keys aren't set on this org.
        if not any(opt_key in keys for opt_key, _ in key_pairs):
            continue

        ois = integration_service.get_organization_integrations(
            organization_id=organization_id,
            providers=[provider],
            status=ObjectStatus.ACTIVE,
        )

        # An org can have multiple ACTIVE installs of the same provider
        # (multi-org GitHub apps); each gets its own per-install config.
        for oi in ois:
            config = dict(oi.config or {})
            set_keys: list[str] = []
            # Backfill every owned key that's true on the org and not
            # already present on the OI. Keys already set are left alone --
            # the per-install UI may have set them explicitly.
            for opt_key, cfg_key in key_pairs:
                if opt_key in keys and cfg_key not in config:
                    config[cfg_key] = True
                    set_keys.append(cfg_key)

            if not set_keys:
                continue

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


@receiver(process_cell_outbox, sender=OutboxCategory.AUDIT_LOG_EVENT)
def process_audit_log_event(payload: Any, **kwds: Any):
    if payload is not None:
        log_rpc_service.record_audit_log(event=AuditLogEvent(**payload))


@receiver(process_cell_outbox, sender=OutboxCategory.ORGAUTHTOKEN_UPDATE_USED)
def process_orgauthtoken_update(payload: Any, **kwds: Any):
    if payload is not None:
        orgauthtoken_rpc_service.update_orgauthtoken(**payload)


@receiver(process_cell_outbox, sender=OutboxCategory.USER_IP_EVENT)
def process_user_ip_event(payload: Any, **kwds: Any):
    if payload is not None:
        log_rpc_service.record_user_ip(event=UserIpEvent(**payload))


@receiver(process_cell_outbox, sender=OutboxCategory.PROJECT_UPDATE)
def process_project_updates(object_identifier: int, **kwds: Any):
    if (proj := maybe_process_tombstone(Project, object_identifier)) is None:
        return
    proj


@receiver(process_cell_outbox, sender=OutboxCategory.ORGANIZATION_MAPPING_CUSTOMER_ID_UPDATE)
def process_organization_mapping_customer_id_update(
    object_identifier: int, payload: Any, **kwds: Any
):
    if (org := maybe_process_tombstone(Organization, object_identifier)) is None:
        return

    if payload and "customer_id" in payload:
        update = update_organization_mapping_from_instance(
            org, get_local_cell(), customer_id=CustomerId(value=payload["customer_id"])
        )
        organization_mapping_service.upsert(organization_id=org.id, update=update)


@receiver(process_cell_outbox, sender=OutboxCategory.DISABLE_AUTH_PROVIDER)
def process_disable_auth_provider(object_identifier: int, shard_identifier: int, **kwds: Any):
    # Deprecated
    auth_service.disable_provider(provider_id=object_identifier)
    AuthProviderReplica.objects.filter(auth_provider_id=object_identifier).delete()


@receiver(process_cell_outbox, sender=OutboxCategory.SEER_RUN_CREATE)
def handle_seer_run_create(object_identifier: int, payload: Any, **kwds: Any) -> None:
    try:
        run = SeerRun.objects.get(id=object_identifier)
    except SeerRun.DoesNotExist:
        return
    if run.seer_run_state_id is not None:
        return
    if run.mirror_status == SeerRunMirrorStatus.FAILED:
        return

    # Validate the payload shape and parse run.type up front. A malformed
    # outbox payload or out-of-band run.type value can't self-heal on retry,
    # so any of these failures are terminal.
    try:
        raw_body = payload["body"]
        if not isinstance(raw_body, dict):
            raise TypeError("payload['body'] is not a dict")
        body = {**raw_body, "external_idempotency_key": str(run.uuid)}
        viewer_context = payload.get("viewer_context")
        run_type = SeerRunType(run.type)
    except (KeyError, TypeError, ValueError) as e:
        _mark_seer_run_failed(run, "seer_run_create.invalid_payload", error=str(e))
        return

    match run_type:
        case SeerRunType.EXPLORER:
            # Add connected and available monitoring providers for runs with user context.
            if run.user_id is not None:
                try:
                    organization = Organization.objects.get_from_cache(id=run.organization_id)
                    monitoring_provider_connections = get_monitoring_provider_connections(
                        organization, run.user_id
                    )
                    if monitoring_provider_connections:
                        body["monitoring_providers"] = monitoring_provider_connections

                    available_monitoring_providers = get_available_monitoring_providers(
                        organization, run.user_id
                    )
                    if available_monitoring_providers:
                        body["available_monitoring_providers"] = available_monitoring_providers
                except Organization.DoesNotExist:
                    logger.warning(
                        "seer_run_create.organization_dne",
                        extra={"organization_id": run.organization_id, "run_id": run.id},
                    )
            response = make_agent_chat_request(
                cast(AgentChatRequest, body), viewer_context=viewer_context
            )
        case SeerRunType.PR_REVIEW:
            # TODO(telkins): support PR review runs. Until then, mark the
            # run FAILED rather than raising — the failure is permanent and
            # raising would stall the org's outbox shard on every drain.
            _mark_seer_run_failed(run, "seer_run_create.pr_review_unsupported")
            return
        case SeerRunType.ASSISTED_QUERY:
            response = make_search_agent_start_request(
                cast(SearchAgentStartRequest, body), viewer_context=viewer_context
            )
        case SeerRunType.FEATURE_RUN:
            wire_body = {**body, "ref": str(run.uuid)}
            response = make_feature_run_request(
                cast(SeerFeatureRunWireRequest, wire_body), viewer_context=viewer_context
            )
        case unknown:
            assert_never(unknown)

    if response.status >= 500:
        raise RuntimeError(f"Seer returned transient error {response.status}")

    if response.status >= 400:
        # Terminal client error — retrying won't help.
        _mark_seer_run_failed(run, "seer_run_create.terminal_failure", status=response.status)
        return

    try:
        data = response.json()
        if not isinstance(data, dict):
            raise TypeError("Seer response is not a JSON object")
    except (json.JSONDecodeError, UnicodeDecodeError, TypeError):
        _mark_seer_run_failed(run, "seer_run_create.invalid_json_body", status=response.status)
        return

    run_id = data.get("run_id")
    if run_id is None:
        _mark_seer_run_failed(run, "seer_run_create.missing_run_id", status=response.status)
        return

    run.seer_run_state_id = run_id
    run.mirror_status = SeerRunMirrorStatus.LIVE
    run.save(update_fields=["seer_run_state_id", "mirror_status"])

    if run_type == SeerRunType.EXPLORER:
        organization_id = run.organization_id
        has_explorer_index = data.get("has_explorer_index")
        has_org_project_context = data.get("has_org_project_context")
        run_id = run.id

        def _trigger_on_commit() -> None:
            try:
                _trigger_explorer_indexes_if_needed(
                    organization_id,
                    has_explorer_index,
                    has_org_project_context,
                )
            except Exception:
                logger.exception(
                    "seer_run_create.explorer_index_trigger_failed",
                    extra={"run_id": run_id},
                )

        transaction.on_commit(_trigger_on_commit, using=router.db_for_write(SeerRun))


def _mark_seer_run_failed(run: SeerRun, event: str, **extra: Any) -> None:
    run.mirror_status = SeerRunMirrorStatus.FAILED
    run.save(update_fields=["mirror_status"])
    logger.warning(event, extra={"run_id": run.id, **extra})


@receiver(process_cell_outbox, sender=OutboxCategory.GROUP_ACTION_LOG_EVENT)
def process_group_action_log_event(payload: GroupActionLogPayload, **kwds: Any) -> None:
    """Write a GroupActionLogEntry from the outbox payload, then trigger
    derived data processing."""
    try:
        using = router.db_for_write(GroupActionLogEntry)

        group_id = payload["group_id"]
        force_async_derived = payload["force_async_derived"]

        try:
            with transaction.atomic(using=using):
                GroupActionLogEntry.objects.create(
                    group_id=group_id,
                    project_id=payload["project_id"],
                    type=payload["type"],
                    actor_type=payload["actor_type"],
                    actor_id=payload["actor_id"],
                    source=payload["source"],
                    data=payload["data"],
                    idempotency_key=payload.get("idempotency_key"),
                )
        except IntegrityError:
            # Idempotency conflict; we treat this as a no-op.
            pass

        # This receiver runs inside the outbox drain transaction
        # (process_shard → transaction.atomic), so the GALE is not yet committed.
        # Defer to on_commit so the GALE is visible to readers on other connections.
        strategy = ProcessingStrategy.ASYNC if force_async_derived else ProcessingStrategy.INLINE
        transaction.on_commit(
            lambda: trigger_group_log_processing(group_id, strategy=strategy), using=using
        )
    except KeyError:
        # Payload schema mismatches (e.g. deploy skew) must not raise —
        # the outbox would retry forever.  Surface in tests so producer bugs
        # are caught, but drop the message in production.
        if in_test_environment():
            raise
        logger.exception(
            "process_group_action_log_event.permanent_failure",
            extra={"payload": payload},
        )
