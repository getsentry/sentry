"""
This module contains signal handler for region outbox messages.

These receivers are triggered on the region silo as outbox messages
are drained. Receivers are expected to make local state changes (tombstones)
and perform RPC calls to propagate changes to Control Silo.
"""

from __future__ import annotations

import logging
from typing import Any

from django.dispatch import receiver

from sentry import options
from sentry.audit_log.services.log import AuditLogEvent, UserIpEvent, log_rpc_service
from sentry.auth.services.auth import auth_service
from sentry.auth.services.orgauthtoken import orgauthtoken_rpc_service
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.hybridcloud.outbox.signals import process_region_outbox
from sentry.hybridcloud.services.organization_mapping import organization_mapping_service
from sentry.hybridcloud.services.organization_mapping.model import CustomerId
from sentry.hybridcloud.services.organization_mapping.serial import (
    update_organization_mapping_from_instance,
)
from sentry.models.authproviderreplica import AuthProviderReplica
from sentry.models.files.utils import get_relocation_storage
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.receivers.outbox import maybe_process_tombstone
from sentry.relocation.services.relocation_export.service import control_relocation_export_service
from sentry.types.region import get_local_region

logger = logging.getLogger(__name__)


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


@receiver(process_region_outbox, sender=OutboxCategory.ORGANIZATION_MAPPING_CUSTOMER_ID_UPDATE)
def process_organization_mapping_customer_id_update(
    object_identifier: int, payload: Any, **kwds: Any
):
    if (org := maybe_process_tombstone(Organization, object_identifier)) is None:
        return

    if payload and "customer_id" in payload:
        update = update_organization_mapping_from_instance(
            org, get_local_region(), customer_id=CustomerId(value=payload["customer_id"])
        )
        organization_mapping_service.upsert(organization_id=org.id, update=update)


@receiver(process_region_outbox, sender=OutboxCategory.DISABLE_AUTH_PROVIDER)
def process_disable_auth_provider(object_identifier: int, shard_identifier: int, **kwds: Any):
    # Deprecated
    auth_service.disable_provider(provider_id=object_identifier)
    AuthProviderReplica.objects.filter(auth_provider_id=object_identifier).delete()


# See the comment on /src/sentry/relocation/tasks/process.py::uploading_start for a detailed description of
# how this outbox drain handler fits into the entire SAAS->SAAS relocation workflow.
@receiver(process_region_outbox, sender=OutboxCategory.RELOCATION_EXPORT_REPLY)
def process_relocation_reply_with_export(payload: Any, **kwds):
    uuid = payload["relocation_uuid"]
    slug = payload["org_slug"]

    killswitch_orgs = options.get("relocation.outbox-orgslug.killswitch")
    if slug in killswitch_orgs:
        logger.info(
            "relocation.killswitch.org",
            extra={
                "org_slug": slug,
                "relocation_uuid": uuid,
            },
        )
        return

    relocation_storage = get_relocation_storage()
    path = f"runs/{uuid}/saas_to_saas_export/{slug}.tar"
    try:
        encrypted_bytes = relocation_storage.open(path)
    except Exception:
        raise FileNotFoundError(
            "Could not open SaaS -> SaaS export in export-side relocation bucket."
        )

    with encrypted_bytes:
        control_relocation_export_service.reply_with_export(
            relocation_uuid=uuid,
            requesting_region_name=payload["requesting_region_name"],
            replying_region_name=payload["replying_region_name"],
            org_slug=slug,
            # TODO(azaslavsky): finish transfer from `encrypted_contents` -> `encrypted_bytes`.
            encrypted_contents=None,
            encrypted_bytes=[int(byte) for byte in encrypted_bytes.read()],
        )
