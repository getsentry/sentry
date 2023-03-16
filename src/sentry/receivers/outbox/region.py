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
from sentry.receivers.outbox import maybe_process_tombstone
from sentry.services.hybrid_cloud.log import AuditLogEvent, UserIpEvent
from sentry.services.hybrid_cloud.log.impl import DatabaseBackedLogService
from sentry.services.hybrid_cloud.organization_mapping import (
    organization_mapping_service,
    update_organization_mapping_from_instance,
)


@receiver(process_region_outbox, sender=OutboxCategory.VERIFY_ORGANIZATION_MAPPING)
def process_organization_mapping_verifications(object_identifier: int, **kwds: Any):
    if (org := maybe_process_tombstone(Organization, object_identifier)) is None:
        return

    organization_mapping_service.verify_mappings(org.id, org.slug)


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


@receiver(process_region_outbox, sender=OutboxCategory.ORGANIZATION_MEMBER_UPDATE)
def process_organization_member_updates(object_identifier: int, **kwds: Any):
    if (org_member := maybe_process_tombstone(OrganizationMember, object_identifier)) is None:
        return
    org_member  # TODO: When we get the org member mapping table in place, here is where we'll sync it.


@receiver(process_region_outbox, sender=OutboxCategory.ORGANIZATION_UPDATE)
def process_organization_updates(object_identifier: int, **kwds: Any):
    if (org := maybe_process_tombstone(Organization, object_identifier)) is None:
        return

    update = update_organization_mapping_from_instance(org)
    organization_mapping_service.update(org.id, update)


@receiver(process_region_outbox, sender=OutboxCategory.PROJECT_UPDATE)
def process_project_updates(object_identifier: int, **kwds: Any):
    if (proj := maybe_process_tombstone(Project, object_identifier)) is None:
        return
    proj
