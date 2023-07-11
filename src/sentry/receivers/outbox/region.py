"""
This module contains signal handler for region outbox messages.

These receivers are triggered on the region silo as outbox messages
are drained. Receivers are expected to make local state changes (tombstones)
and perform RPC calls to propagate changes to Control Silo.
"""
from __future__ import annotations

from typing import Any

from django.dispatch import receiver

from sentry.models import (
    Organization,
    OrganizationMember,
    OutboxCategory,
    Project,
    process_region_outbox,
)
from sentry.models.team import Team
from sentry.receivers.outbox import maybe_process_tombstone
from sentry.services.hybrid_cloud.identity import identity_service
from sentry.services.hybrid_cloud.log import AuditLogEvent, UserIpEvent, log_rpc_service
from sentry.services.hybrid_cloud.organization_mapping import organization_mapping_service
from sentry.services.hybrid_cloud.organization_mapping.serial import (
    update_organization_mapping_from_instance,
)
from sentry.services.hybrid_cloud.organizationmember_mapping import (
    RpcOrganizationMemberMappingUpdate,
    organizationmember_mapping_service,
)
from sentry.services.hybrid_cloud.orgauthtoken import orgauthtoken_rpc_service
from sentry.types.region import get_local_region


@receiver(process_region_outbox, sender=OutboxCategory.AUDIT_LOG_EVENT)
def process_audit_log_event(payload: Any, **kwds: Any):
    if payload is not None:
        log_rpc_service.record_audit_log(event=AuditLogEvent(**payload))


@receiver(process_region_outbox, sender=OutboxCategory.ORGAUTHTOKEN_UPDATE)
def process_orgauthtoken_update(payload: Any, **kwds: Any):
    if payload is not None:
        orgauthtoken_rpc_service.update_orgauthtoken(**payload)


@receiver(process_region_outbox, sender=OutboxCategory.USER_IP_EVENT)
def process_user_ip_event(payload: Any, **kwds: Any):
    if payload is not None:
        log_rpc_service.record_user_ip(event=UserIpEvent(**payload))


# No longer used.
@receiver(process_region_outbox, sender=OutboxCategory.ORGANIZATION_MEMBER_CREATE)
def process_organization_member_create(
    object_identifier: int, payload: Any, shard_identifier: int, **kwds: Any
):
    pass


@receiver(process_region_outbox, sender=OutboxCategory.ORGANIZATION_MEMBER_UPDATE)
def process_organization_member_updates(
    object_identifier: int, payload: Any, shard_identifier: int, **kwds: Any
):
    if (org_member := OrganizationMember.objects.filter(id=object_identifier).last()) is None:
        # Delete all identities that may have been associated.  This is an implicit cascade.
        if payload and payload.get("user_id") is not None:
            identity_service.delete_identities(
                user_id=payload["user_id"], organization_id=shard_identifier
            )
        organizationmember_mapping_service.delete(
            organizationmember_id=object_identifier,
            organization_id=shard_identifier,
        )
        return

    rpc_org_member_update = RpcOrganizationMemberMappingUpdate.from_orm(org_member)

    organizationmember_mapping_service.upsert_mapping(
        organizationmember_id=org_member.id,
        organization_id=shard_identifier,
        mapping=rpc_org_member_update,
    )


@receiver(process_region_outbox, sender=OutboxCategory.TEAM_UPDATE)
def process_team_updates(
    object_identifier: int, payload: Any, shard_identifier: int, **kwargs: Any
):
    maybe_process_tombstone(Team, object_identifier)


@receiver(process_region_outbox, sender=OutboxCategory.ORGANIZATION_UPDATE)
def process_organization_updates(object_identifier: int, **kwds: Any):
    if (org := maybe_process_tombstone(Organization, object_identifier)) is None:
        organization_mapping_service.delete(organization_id=object_identifier)
        return

    update = update_organization_mapping_from_instance(org, get_local_region())
    organization_mapping_service.upsert(organization_id=org.id, update=update)


@receiver(process_region_outbox, sender=OutboxCategory.PROJECT_UPDATE)
def process_project_updates(object_identifier: int, **kwds: Any):
    if (proj := maybe_process_tombstone(Project, object_identifier)) is None:
        return
    proj


@receiver(process_region_outbox, sender=OutboxCategory.ORGANIZATION_MAPPING_CUSTOMER_ID_UPDATE)
def process_organization_mapping_customer_id_update(
    object_identifier: int, payload: Any, **kwds: Any
):
    if (org := maybe_process_tombstone(Organization, object_identifier)) is None:
        return

    if payload and "customer_id" in payload:
        organization_mapping_service.update(
            organization_id=org.id, update={"customer_id": payload["customer_id"]}
        )
