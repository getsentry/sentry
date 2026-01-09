"""
This module contains signal handler for control silo outbox messages.

These receivers are triggered on the control silo as outbox messages
are drained. Receivers are expected to make local state changes (tombstones)
and perform RPC calls to propagate changes to relevant region(s).
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from django.dispatch import receiver

from sentry.constants import ObjectStatus
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.hybridcloud.outbox.signals import process_control_outbox
from sentry.integrations.models.integration import Integration
from sentry.issues.services.issue import issue_service
from sentry.models.apiapplication import ApiApplication
from sentry.organizations.services.organization import RpcOrganizationSignal, organization_service
from sentry.receivers.outbox import maybe_process_tombstone
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.services.hook.service import hook_service
from sentry.sentry_apps.tasks.sentry_apps import clear_region_cache
from sentry.users.models.identity import Identity
from sentry.workflow_engine.service.action.service import action_service

logger = logging.getLogger(__name__)


@receiver(process_control_outbox, sender=OutboxCategory.INTEGRATION_UPDATE)
def process_integration_updates(object_identifier: int, region_name: str, **kwds: Any):
    if (
        integration := maybe_process_tombstone(
            Integration, object_identifier, region_name=region_name
        )
    ) is None:
        return
    integration  # Currently we do not sync any other integration changes, but if we did, you can use this variable.


@receiver(process_control_outbox, sender=OutboxCategory.IDENTITY_UPDATE)
def process_identity_updates(object_identifier: int, region_name: str, **kwds: Any):
    maybe_process_tombstone(Identity, object_identifier, region_name=region_name)


@receiver(process_control_outbox, sender=OutboxCategory.SENTRY_APP_UPDATE)
def process_sentry_app_updates(object_identifier: int, region_name: str, **kwds: Any):
    if (
        sentry_app := maybe_process_tombstone(
            model=SentryApp, object_identifier=object_identifier, region_name=region_name
        )
    ) is None:
        return

    # Spawn a task to clear caches, as there can be 1000+ installations
    # for a sentry app.
    clear_region_cache.delay(sentry_app_id=sentry_app.id, region_name=region_name)


@receiver(process_control_outbox, sender=OutboxCategory.SENTRY_APP_DELETE)
def process_sentry_app_deletes(
    shard_identifier: int,
    object_identifier: int,
    region_name: str,
    payload: Mapping[str, Any],
    **kwds: Any,
):
    action_service.update_action_status_for_sentry_app_via_sentry_app_id(
        region_name=region_name,
        status=ObjectStatus.DISABLED,
        sentry_app_id=object_identifier,
    )
    if slug := payload.get("slug"):
        action_service.update_action_status_for_webhook_via_sentry_app_slug(
            region_name=region_name,
            status=ObjectStatus.DISABLED,
            sentry_app_slug=slug,
        )


@receiver(process_control_outbox, sender=OutboxCategory.SENTRY_APP_INSTALLATION_DELETE)
def process_sentry_app_installation_deletes(
    shard_identifier: int,
    object_identifier: int,
    region_name: str,
    payload: Mapping[str, Any],
    **kwds: Any,
):
    action_service.update_action_status_for_sentry_app_via_uuid__region(
        region_name=region_name,
        status=ObjectStatus.DISABLED,
        sentry_app_install_uuid=payload["uuid"],
    )


@receiver(process_control_outbox, sender=OutboxCategory.API_APPLICATION_UPDATE)
def process_api_application_updates(object_identifier: int, region_name: str, **kwds: Any):
    if (
        api_application := maybe_process_tombstone(
            ApiApplication, object_identifier, region_name=region_name
        )
    ) is None:
        return
    api_application  # Currently we do not sync any other api application changes, but if we did, you can use this variable.


@receiver(process_control_outbox, sender=OutboxCategory.SERVICE_HOOK_UPDATE)
def process_service_hook_updates(object_identifier: int, region_name: str, **kwds: Any):
    try:
        installation = SentryAppInstallation.objects.select_related("sentry_app").get(
            id=object_identifier
        )
    except SentryAppInstallation.DoesNotExist:
        logger.warning(
            "process_service_hook_updates.installation_not_found",
            extra={"installation_id": object_identifier},
        )
        return

    hook_service.create_or_update_webhook_and_events_for_installation(
        installation_id=installation.id,
        organization_id=installation.organization_id,
        webhook_url=installation.sentry_app.webhook_url,
        events=installation.sentry_app.events,
        application_id=installation.sentry_app.application_id,
    )

    logger.info(
        "process_service_hook_updates.called_rpc",
        extra={
            "installation_id": installation.id,
            "sentry_app_id": installation.sentry_app.id,
            "events": installation.sentry_app.events,
            "application_id": installation.sentry_app.application_id,
        },
    )


@receiver(process_control_outbox, sender=OutboxCategory.SEND_SIGNAL)
def process_send_signal(payload: Mapping[str, Any], shard_identifier: int, **kwds: Any):
    organization_service.send_signal(
        organization_id=shard_identifier,
        args=payload["args"],
        signal=RpcOrganizationSignal(payload["signal"]),
    )


@receiver(process_control_outbox, sender=OutboxCategory.RESET_IDP_FLAGS)
def process_reset_idp_flags(shard_identifier: int, **kwds: Any):
    organization_service.reset_idp_flags(organization_id=shard_identifier)


@receiver(process_control_outbox, sender=OutboxCategory.MARK_INVALID_SSO)
def process_mark_invalid_sso(object_identifier: int, shard_identifier: int, **kwds: Any):
    # since we've identified an identity which is no longer valid
    # lets preemptively mark it as such
    other_member = organization_service.check_membership_by_id(
        user_id=object_identifier,
        organization_id=shard_identifier,
    )
    if other_member is None:
        return

    other_member.flags.sso__invalid = True
    other_member.flags.sso__linked = False
    organization_service.update_membership_flags(organization_member=other_member)


@receiver(process_control_outbox, sender=OutboxCategory.ISSUE_COMMENT_UPDATE)
def process_issue_email_reply(shard_identifier: int, payload: Any, **kwds):
    issue_service.upsert_issue_email_reply(
        organization_id=shard_identifier,
        group_id=payload["group_id"],
        from_email=payload["from_email"],
        text=payload["text"],
    )
