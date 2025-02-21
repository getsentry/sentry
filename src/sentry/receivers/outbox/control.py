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

from sentry import options
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.hybridcloud.outbox.signals import process_control_outbox
from sentry.integrations.models.integration import Integration
from sentry.issues.services.issue import issue_service
from sentry.models.apiapplication import ApiApplication
from sentry.models.files.utils import get_relocation_storage
from sentry.organizations.services.organization import RpcOrganizationSignal, organization_service
from sentry.receivers.outbox import maybe_process_tombstone
from sentry.relocation.services.relocation_export.service import region_relocation_export_service
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.tasks.sentry_apps import clear_region_cache

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

    # Spawn a task to clear caches, as there can be 1000+ installations
    # for a sentry app.
    clear_region_cache.delay(sentry_app_id=sentry_app.id, region_name=region_name)


@receiver(process_control_outbox, sender=OutboxCategory.API_APPLICATION_UPDATE)
def process_api_application_updates(object_identifier: int, region_name: str, **kwds: Any):
    if (
        api_application := maybe_process_tombstone(
            ApiApplication, object_identifier, region_name=region_name
        )
    ) is None:
        return
    api_application  # Currently we do not sync any other api application changes, but if we did, you can use this variable.


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


# See the comment on /src/sentry/relocation/tasks.py::uploading_start for a detailed description of
# how this outbox drain handler fits into the entire SAAS->SAAS relocation workflow.
@receiver(process_control_outbox, sender=OutboxCategory.RELOCATION_EXPORT_REQUEST)
def process_relocation_request_new_export(payload: Mapping[str, Any], **kwds):
    encrypt_with_public_key = (
        payload["encrypt_with_public_key"].encode("utf-8")
        if isinstance(payload["encrypt_with_public_key"], str)
        else payload["encrypt_with_public_key"]
    )
    region_relocation_export_service.request_new_export(
        relocation_uuid=payload["relocation_uuid"],
        requesting_region_name=payload["requesting_region_name"],
        replying_region_name=payload["replying_region_name"],
        org_slug=payload["org_slug"],
        encrypt_with_public_key=encrypt_with_public_key,
    )


# See the comment on /src/sentry/relocation/tasks.py::uploading_start for a detailed description of
# how this outbox drain handler fits into the entire SAAS->SAAS relocation workflow.
@receiver(process_control_outbox, sender=OutboxCategory.RELOCATION_EXPORT_REPLY)
def process_relocation_reply_with_export(payload: Mapping[str, Any], **kwds):
    # We expect the `ProxyRelocationExportService::reply_with_export` implementation to have written
    # the export data to the control silo's local relocation-specific GCS bucket. Here, we just read
    # it into memory and attempt the RPC call back to the requesting region.
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
        raise FileNotFoundError("Could not open SaaS -> SaaS export in proxy relocation bucket.")

    with encrypted_bytes:
        region_relocation_export_service.reply_with_export(
            relocation_uuid=payload["relocation_uuid"],
            requesting_region_name=payload["requesting_region_name"],
            replying_region_name=payload["replying_region_name"],
            org_slug=payload["org_slug"],
            # TODO(azaslavsky): finish transfer from `encrypted_contents` -> `encrypted_bytes`.
            encrypted_contents=None,
            encrypted_bytes=[int(byte) for byte in encrypted_bytes.read()],
        )
