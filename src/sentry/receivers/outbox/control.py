"""
This module contains signal handler for control silo outbox messages.

These receivers are triggered on the control silo as outbox messages
are drained. Receivers are expected to make local state changes (tombstones)
and perform RPC calls to propagate changes to relevant region(s).
"""
from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Mapping
from typing import Any

from django.dispatch import receiver

from sentry.hybridcloud.rpc.services.caching import region_caching_service
from sentry.models.apiapplication import ApiApplication
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.sentry_app import SentryApp
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.outbox import OutboxCategory, process_control_outbox
from sentry.receivers.outbox import maybe_process_tombstone
from sentry.services.hybrid_cloud.app.service import get_by_application_id, get_installation
from sentry.services.hybrid_cloud.issue import issue_service
from sentry.services.hybrid_cloud.organization import RpcOrganizationSignal, organization_service

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

    # When a sentry app's definition changes purge cache for all the installations.
    # This could get slow for large applications, but generally big applications don't change often.
    install_query = SentryAppInstallation.objects.filter(sentry_app=sentry_app).values(
        "id", "organization_id"
    )
    # There isn't a constraint on org : sentryapp so we have to handle lists
    install_map: dict[int, list[int]] = defaultdict(list)
    for install_row in install_query:
        install_map[install_row["organization_id"]].append(install_row["id"])

    # Clear application_id cache
    region_caching_service.clear_key(
        key=get_by_application_id.key_from(sentry_app.application_id), region_name=region_name
    )

    # Limit our operations to the region this outbox is for.
    # This could be a single query if we use raw_sql.
    region_query = OrganizationMapping.objects.filter(
        organization_id__in=list(install_map.keys()), region_name=region_name
    ).values("organization_id")
    for region_row in region_query:
        installs = install_map[region_row["organization_id"]]
        for install_id in installs:
            region_caching_service.clear_key(
                key=get_installation.key_from(install_id), region_name=region_name
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
