"""
This module contains signal handler for control silo outbox messages.

These receivers are triggered on the control silo as outbox messages
are drained. Receivers are expected to make local state changes (tombstones)
and perform RPC calls to propagate changes to relevant region(s).
"""
from __future__ import annotations

import logging
from hashlib import sha1
from typing import Any, Mapping

import sentry_sdk
from django.dispatch import receiver
from requests import Response
from requests.exceptions import HTTPError
from rest_framework import status

from sentry.exceptions import RestrictedIPAddress
from sentry.models.apiapplication import ApiApplication
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.sentry_app import SentryApp
from sentry.models.outbox import OutboxCategory, process_control_outbox
from sentry.receivers.outbox import maybe_process_tombstone
from sentry.services.hybrid_cloud.issue import issue_service
from sentry.services.hybrid_cloud.organization import RpcOrganizationSignal, organization_service
from sentry.shared_integrations.exceptions import (
    ApiConflictError,
    ApiConnectionResetError,
    ApiError,
    ApiHostError,
    ApiTimeoutError,
)
from sentry.silo.base import SiloMode
from sentry.silo.client import SiloClientError
from sentry.utils import metrics

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


@receiver(process_control_outbox, sender=OutboxCategory.WEBHOOK_PROXY)
def process_async_webhooks(
    payload: Mapping[str, Any],
    region_name: str,
    shard_identifier: int,
    object_identifier: int,
    **kwds: Any,
):
    from sentry.models.outbox import ControlOutbox
    from sentry.silo.client import RegionSiloClient
    from sentry.types.region import get_region_by_name

    if SiloMode.get_current_mode() == SiloMode.REGION:
        sentry_sdk.capture_exception(Exception("Called process_async_webhooks in REGION mode"))
        return

    region = get_region_by_name(name=region_name)
    webhook_payload = ControlOutbox.get_webhook_payload_from_outbox(payload=payload)

    try:
        client = RegionSiloClient(region=region)
        with metrics.timer(
            "integration_proxy.control.process_async_webhooks",
            tags={"destination_region": region.name},
            sample_rate=1.0,
        ):
            response = client.request(
                method=webhook_payload.method,
                path=webhook_payload.path,
                headers=webhook_payload.headers,
                # We need to send the body as raw bytes to avoid interfering with webhook signatures
                data=webhook_payload.body.encode("utf-8"),
                json=False,
                prefix_hash=sha1(f"{shard_identifier}{object_identifier}".encode()).hexdigest(),
            )
        logger.info(
            "webhook_proxy.complete",
            extra={
                "status": getattr(
                    response, "status_code", 204
                ),  # Request returns empty dict instead of a response object when the code is a 204
                "request_path": webhook_payload.path,
                "request_method": webhook_payload.method,
            },
        )
    except SiloClientError as e:
        sentry_sdk.capture_exception(e)
    except ApiHostError as err:
        with sentry_sdk.push_scope() as scope:
            scope.set_context(
                "region",
                {
                    "name": region.name,
                    "id": region.category,
                    "address": region.address,
                },
            )
            err_cause = err.__cause__
            if err_cause is not None and isinstance(err_cause, RestrictedIPAddress):
                # Region silos that are IP address restricted are actionable.
                silo_client_err = SiloClientError("Region silo is IP address restricted")
                silo_client_err.__cause__ = err
                sentry_sdk.capture_exception(silo_client_err)
                return
            sentry_sdk.capture_exception(err)
        return
    except ApiConflictError as e:
        logger.warning(
            "webhook_proxy.conflict_occurred",
            extra={
                "request_path": webhook_payload.path,
                "request_method": webhook_payload.method,
                "conflict_text": e.text,
            },
        )
    except ApiTimeoutError as err:
        raise err
    except ApiConnectionResetError as err:
        raise err
    except ApiError as api_err:
        err_cause = api_err.__cause__
        if err_cause is not None and isinstance(err_cause, HTTPError):
            orig_response: Response | None = err_cause.response
            if (
                orig_response is not None
                and status.HTTP_500_INTERNAL_SERVER_ERROR <= orig_response.status_code < 600
            ):
                # Retry on 5xx errors
                raise api_err
        # For some integrations, we make use of outboxes to handle asynchronous webhook requests.
        # There is an edge case where webhook requests eventually become invalid and
        # the 3rd-party destination (integration provider) will reject them.
        # JWT expirations is one example of causing this issue. Issues like these are no longer salvageable, and we must
        # discard these associated webhook outbox messages. If we do not discard them, then these outbox messages
        # will be re-processed causing a backlog on the ControlOutbox table.
        return


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
