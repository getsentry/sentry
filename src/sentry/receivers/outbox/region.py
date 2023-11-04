"""
This module contains signal handler for region outbox messages.

These receivers are triggered on the region silo as outbox messages
are drained. Receivers are expected to make local state changes (tombstones)
and perform RPC calls to propagate changes to Control Silo.
"""
from __future__ import annotations

from typing import Any

from django.dispatch import receiver

from sentry.models.actor import Actor
from sentry.models.authproviderreplica import AuthProviderReplica
from sentry.models.organization import Organization
from sentry.models.outbox import OutboxCategory, process_region_outbox
from sentry.models.project import Project
from sentry.receivers.outbox import maybe_process_tombstone
from sentry.services.hybrid_cloud.auth import auth_service
from sentry.services.hybrid_cloud.log import AuditLogEvent, UserIpEvent, log_rpc_service
from sentry.services.hybrid_cloud.organization_mapping import organization_mapping_service
from sentry.services.hybrid_cloud.organization_mapping.serial import (
    update_organization_mapping_from_instance,
)
from sentry.services.hybrid_cloud.orgauthtoken import orgauthtoken_rpc_service
from sentry.types.region import get_local_region


@receiver(process_region_outbox, sender=OutboxCategory.AUDIT_LOG_EVENT)
def process_audit_log_event(payload: Any, **kwds: Any):
    if payload is not None:
        log_rpc_service.record_audit_log(event=AuditLogEvent(**payload))


@receiver(process_region_outbox, sender=OutboxCategory.ORGAUTHTOKEN_UPDATE_USED)
def process_orgauthtoken_update(payload: Any, **kwds: Any):
    if payload is not None:
        orgauthtoken_rpc_service.update_orgauthtoken(**payload)


@receiver(process_region_outbox, sender=OutboxCategory.USER_IP_EVENT)
def process_user_ip_event(payload: Any, **kwds: Any):
    if payload is not None:
        log_rpc_service.record_user_ip(event=UserIpEvent(**payload))


@receiver(process_region_outbox, sender=OutboxCategory.PROJECT_UPDATE)
def process_project_updates(object_identifier: int, **kwds: Any):
    if (proj := maybe_process_tombstone(Project, object_identifier)) is None:
        return
    proj


@receiver(process_region_outbox, sender=OutboxCategory.ACTOR_UPDATE)
def process_actor_updates(object_identifier: int, **kwds: Any):
    if (actor := maybe_process_tombstone(Actor, object_identifier)) is None:
        return
    actor


@receiver(process_region_outbox, sender=OutboxCategory.ORGANIZATION_MAPPING_CUSTOMER_ID_UPDATE)
def process_organization_mapping_customer_id_update(
    object_identifier: int, payload: Any, **kwds: Any
):
    if (org := maybe_process_tombstone(Organization, object_identifier)) is None:
        return

    if payload and "customer_id" in payload:
        update = update_organization_mapping_from_instance(
            org, get_local_region(), customer_id=(payload["customer_id"],)
        )
        organization_mapping_service.upsert(organization_id=org.id, update=update)


@receiver(process_region_outbox, sender=OutboxCategory.DISABLE_AUTH_PROVIDER)
def process_disable_auth_provider(object_identifier: int, shard_identifier: int, **kwds: Any):
    auth_service.disable_provider(provider_id=object_identifier)
    AuthProviderReplica.objects.filter(auth_provider_id=object_identifier).delete()
