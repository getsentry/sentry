"""
This module contains signal handler for control silo outbox messages.

These receivers are triggered on the control silo as outbox messages
are drained. Receivers are expected to make local state changes (tombstones)
and perform RPC calls to propagate changes to relevant region(s).
"""
from __future__ import annotations

import logging
from typing import Any, Mapping

from django.dispatch import receiver

from sentry.models.apiapplication import ApiApplication
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.sentry_app import SentryApp
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.outbox import OutboxCategory, process_control_outbox
from sentry.receivers.outbox import maybe_process_tombstone
from sentry.services.hybrid_cloud.organization import RpcOrganizationSignal, organization_service
from sentry.silo.base import SiloMode

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


@receiver(process_control_outbox, sender=OutboxCategory.SENTRY_APP_UPDATE)
def process_sentry_app_updates(object_identifier: int, region_name: str, **kwds: Any):
    if (
        sentry_app := maybe_process_tombstone(
            model=SentryApp, object_identifier=object_identifier, region_name=region_name
        )
    ) is None:
        return
    sentry_app  # Currently we do not sync any other sentry_app changes, but if we did, you can use this variable.


@receiver(process_control_outbox, sender=OutboxCategory.API_APPLICATION_UPDATE)
def process_api_application_updates(object_identifier: int, region_name: str, **kwds: Any):
    if (
        api_application := maybe_process_tombstone(
            ApiApplication, object_identifier, region_name=region_name
        )
    ) is None:
        return
    api_application  # Currently we do not sync any other api application changes, but if we did, you can use this variable.


@receiver(process_control_outbox, sender=OutboxCategory.SENTRY_APP_INSTALLATION_UPDATE)
def process_sentry_app_installation_updates(object_identifier: int, region_name: str, **kwds: Any):
    if (
        sentry_app_installation := maybe_process_tombstone(
            SentryAppInstallation, object_identifier, region_name=region_name
        )
    ) is None:
        return
    sentry_app_installation  # Currently we do not sync any other api application changes, but if we did, you can use this variable.


@receiver(process_control_outbox, sender=OutboxCategory.WEBHOOK_PROXY)
def process_async_webhooks(payload: Mapping[str, Any], region_name: str, **kwds: Any):
    from sentry.models.outbox import ControlOutbox
    from sentry.silo.client import RegionSiloClient
    from sentry.types.region import get_region_by_name

    region = get_region_by_name(name=region_name)
    webhook_payload = ControlOutbox.get_webhook_payload_from_outbox(payload=payload)

    if SiloMode.get_current_mode() == SiloMode.CONTROL:
        # By default, these clients will raise errors on non-20x response codes
        response = RegionSiloClient(region=region).request(
            method=webhook_payload.method,
            path=webhook_payload.path,
            headers=webhook_payload.headers,
            # We need to send the body as raw bytes to avoid interfering with webhook signatures
            data=webhook_payload.body,
            json=False,
        )
        logger.info(
            "webhook_proxy.complete",
            extra={
                "status": response.status_code,
                "request_path": webhook_payload.path,
                "request_method": webhook_payload.method,
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
