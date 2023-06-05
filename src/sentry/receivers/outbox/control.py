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

from sentry.models import (
    ApiApplication,
    Integration,
    OrganizationIntegration,
    OutboxCategory,
    SentryAppInstallation,
    User,
    process_control_outbox,
)
from sentry.receivers.outbox import maybe_process_tombstone
from sentry.services.hybrid_cloud.organization import RpcRegionUser, organization_service
from sentry.silo.base import SiloMode

logger = logging.getLogger(__name__)


@receiver(process_control_outbox, sender=OutboxCategory.USER_UPDATE)
def process_user_updates(object_identifier: int, region_name: str, **kwds: Any):
    if (user := maybe_process_tombstone(User, object_identifier)) is None:
        return
    organization_service.update_region_user(
        user=RpcRegionUser(id=user.id, is_active=user.is_active), region_name=region_name
    )


@receiver(process_control_outbox, sender=OutboxCategory.INTEGRATION_UPDATE)
def process_integration_updates(object_identifier: int, **kwds: Any):
    if (integration := maybe_process_tombstone(Integration, object_identifier)) is None:
        return
    integration  # Currently we do not sync any other integration changes, but if we did, you can use this variable.


@receiver(process_control_outbox, sender=OutboxCategory.API_APPLICATION_UPDATE)
def process_api_application_updates(object_identifier: int, **kwds: Any):
    if (api_application := maybe_process_tombstone(ApiApplication, object_identifier)) is None:
        return
    api_application  # Currently we do not sync any other api application changes, but if we did, you can use this variable.


@receiver(process_control_outbox, sender=OutboxCategory.SENTRY_APP_INSTALLATION_UPDATE)
def process_sentry_app_installation_updates(object_identifier: int, **kwds: Any):
    if (
        sentry_app_installation := maybe_process_tombstone(SentryAppInstallation, object_identifier)
    ) is None:
        return
    sentry_app_installation  # Currently we do not sync any other api application changes, but if we did, you can use this variable.


@receiver(process_control_outbox, sender=OutboxCategory.ORGANIZATION_INTEGRATION_UPDATE)
def process_organization_integration_update(object_identifier: int, **kwds: Any):
    if (
        organization_integration := maybe_process_tombstone(
            OrganizationIntegration, object_identifier
        )
    ) is None:
        return
    organization_integration  # Currently we do not sync any other organization integration changes, but if we did, you can use this variable.


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
