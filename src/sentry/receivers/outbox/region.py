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
from sentry.services.hybrid_cloud.log import AuditLogEvent, UserIpEvent
from sentry.services.hybrid_cloud.log.impl import DatabaseBackedLogService
from sentry.services.hybrid_cloud.organization_mapping import organization_mapping_service
from sentry.services.hybrid_cloud.organization_mapping.serial import (
    update_organization_mapping_from_instance,
)
from sentry.services.hybrid_cloud.organizationmember_mapping import (
    RpcOrganizationMemberMappingUpdate,
    organizationmember_mapping_service,
)
from sentry.signals import member_joined


@receiver(process_region_outbox, sender=OutboxCategory.VERIFY_ORGANIZATION_MAPPING)
def process_organization_mapping_verifications(object_identifier: int, **kwds: Any):
    if (org := maybe_process_tombstone(Organization, object_identifier)) is None:
        return

    organization_mapping_service.verify_mappings(organization_id=org.id, slug=org.slug)


@receiver(process_region_outbox, sender=OutboxCategory.AUDIT_LOG_EVENT)
def process_audit_log_event(payload: Any, **kwds: Any):
    # TODO: This will become explicit rpc
    if payload is not None:
        DatabaseBackedLogService().record_audit_log(event=AuditLogEvent(**payload))


@receiver(process_region_outbox, sender=OutboxCategory.USER_IP_EVENT)
def process_user_ip_event(payload: Any, **kwds: Any):
    # TODO: This will become explicit rpc
    if payload is not None:
        DatabaseBackedLogService().record_user_ip(event=UserIpEvent(**payload))


@receiver(process_region_outbox, sender=OutboxCategory.ORGANIZATION_MEMBER_CREATE)
def process_organization_member_create(
    object_identifier: int, payload: Any, shard_identifier: int, **kwds: Any
):
    if (org_member := OrganizationMember.objects.filter(id=object_identifier).last()) is None:
        return

    organizationmember_mapping_service.create_with_organization_member(org_member=org_member)
    member_joined.send_robust(
        sender=None,
        member=org_member,
        organization_id=org_member.organization_id,
    )


@receiver(process_region_outbox, sender=OutboxCategory.ORGANIZATION_MEMBER_UPDATE)
def process_organization_member_updates(
    object_identifier: int, payload: Any, shard_identifier: int, **kwds: Any
):
    if (org_member := OrganizationMember.objects.filter(id=object_identifier).last()) is None:
        # Delete all identities that may have been associated.  This is an implicit cascade.
        if payload and "user_id" in payload:
            identity_service.delete_identities(
                user_id=payload["user_id"], organization_id=shard_identifier
            )
        organizationmember_mapping_service.delete_with_organization_member(
            organizationmember_id=object_identifier, organization_id=shard_identifier
        )
        return

    rpc_org_member_update = RpcOrganizationMemberMappingUpdate.from_orm(org_member)

    organizationmember_mapping_service.update_with_organization_member(
        organizationmember_id=org_member.id,
        organization_id=shard_identifier,
        rpc_update_org_member=rpc_org_member_update,
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

    update = update_organization_mapping_from_instance(org)
    organization_mapping_service.update(organization_id=org.id, update=update)


@receiver(process_region_outbox, sender=OutboxCategory.PROJECT_UPDATE)
def process_project_updates(object_identifier: int, **kwds: Any):
    if (proj := maybe_process_tombstone(Project, object_identifier)) is None:
        return
    proj
