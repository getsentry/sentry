from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import cast
from urllib.error import URLError

from rest_framework.response import Response
from slack_sdk.errors import SlackRequestError
from slack_sdk.webhook import WebhookClient

from sentry import features
from sentry.auth.access import from_member
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.message_builder.types import SlackAction
from sentry.integrations.slack.requests.action import SlackActionRequest
from sentry.models.organization import Organization
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.seer import agent_token
from sentry.seer.agent.client_utils import (
    AgentUpdateRequest,
    fetch_run_status,
    make_agent_update_request,
)
from sentry.seer.endpoints.agent_request import (
    AgentApprovalRequestData,
    AgentApprovalRequestSerializer,
)
from sentry.seer.endpoints.utils import resolve_seer_run
from sentry.seer.entrypoints.cache import SeerOperatorAgentCache
from sentry.seer.entrypoints.operator import SeerAgentOperator
from sentry.seer.entrypoints.slack.cache import SlackSeerAgentMessageCache
from sentry.seer.entrypoints.slack.entrypoint import SlackAgentCachePayload
from sentry.seer.entrypoints.types import SeerEntrypointKey
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import SeerViewerContext

_logger = logging.getLogger(__name__)

SEER_AGENT_WRITE_APPROVAL_ACTIONS = frozenset(
    {
        SlackAction.SEER_AGENT_WRITE_APPROVE.value,
        SlackAction.SEER_AGENT_WRITE_REJECT.value,
    }
)

AGENT_WRITE_APPROVAL_UNAVAILABLE_MESSAGE = "This approval request is no longer available."
AGENT_WRITE_APPROVAL_ERROR_MESSAGE = "Sentry can't perform that action right now on your behalf!"
AGENT_WRITE_APPROVAL_INSUFFICIENT_MESSAGE = (
    "You do not have all the Sentry permissions requested by Seer."
)


def _respond_ephemeral(text: str) -> Response:
    return Response({"response_type": "ephemeral", "replace_original": False, "text": text})


def _update_agent_write_approval_message(
    *,
    slack_request: SlackActionRequest,
    organization_id: int,
    run_id: int,
    approved: bool,
) -> bool:
    text = ":white_check_mark: Access granted." if approved else ":x: Access not granted."
    try:
        webhook_client = WebhookClient(slack_request.response_url)
        response = webhook_client.send(
            text=text,
            replace_original=True,
        )
    except (SlackRequestError, URLError, TimeoutError, ConnectionResetError):
        _logger.exception(
            "seer.slack.agent_write_approval.message_update_failed",
            extra={"organization_id": organization_id, "run_id": run_id},
        )
        return False
    if response.status_code >= 400:
        _logger.warning(
            "seer.slack.agent_write_approval.message_update_failed",
            extra={
                "organization_id": organization_id,
                "run_id": run_id,
                "status": response.status_code,
            },
        )
        return False
    return True


def handle_seer_agent_write_approval(
    *,
    slack_request: SlackActionRequest,
    action: SlackAction,
    organization_id: int | None,
) -> Response:
    container = slack_request.data.get("container")
    channel_id = container.get("channel_id") if isinstance(container, Mapping) else None
    message_ts = container.get("message_ts") if isinstance(container, Mapping) else None
    if (
        organization_id is None
        or not isinstance(channel_id, str)
        or not isinstance(message_ts, str)
    ):
        return _respond_ephemeral(AGENT_WRITE_APPROVAL_UNAVAILABLE_MESSAGE)

    cached_message = SlackSeerAgentMessageCache.get(
        integration_id=slack_request.integration.id,
        channel_id=channel_id,
        message_ts=message_ts,
    )
    if not cached_message or not isinstance(cached_message.get("input_id"), str):
        return _respond_ephemeral(AGENT_WRITE_APPROVAL_UNAVAILABLE_MESSAGE)
    run_id = cached_message["run_id"]
    input_id = cached_message["input_id"]

    organization_integrations = integration_service.get_organization_integrations(
        integration_id=slack_request.integration.id,
        organization_id=organization_id,
        status=ObjectStatus.ACTIVE,
        limit=1,
    )
    if not organization_integrations:
        return _respond_ephemeral(AGENT_WRITE_APPROVAL_UNAVAILABLE_MESSAGE)

    identity_user = slack_request.get_identity_user()
    if not identity_user or not identity_user.is_active or identity_user.is_suspended:
        return _respond_ephemeral(AGENT_WRITE_APPROVAL_UNAVAILABLE_MESSAGE)
    slack_user_id = slack_request.user_id
    if slack_user_id is None:
        return _respond_ephemeral(AGENT_WRITE_APPROVAL_UNAVAILABLE_MESSAGE)

    organization = Organization.objects.filter(id=organization_id).first()
    if not organization or not SeerAgentOperator.has_access(
        organization=organization,
        entrypoint_key=SeerEntrypointKey.SLACK,
    ):
        return _respond_ephemeral(AGENT_WRITE_APPROVAL_UNAVAILABLE_MESSAGE)
    if action == SlackAction.SEER_AGENT_WRITE_APPROVE and not features.has(
        agent_token.FEATURE_FLAG, organization, actor=identity_user
    ):
        return _respond_ephemeral(AGENT_WRITE_APPROVAL_UNAVAILABLE_MESSAGE)

    try:
        member = OrganizationMember.objects.get(
            user_id=identity_user.id,
            organization_id=organization.id,
            invite_status=InviteStatus.APPROVED.value,
        )
    except OrganizationMember.DoesNotExist:
        return _respond_ephemeral(AGENT_WRITE_APPROVAL_UNAVAILABLE_MESSAGE)

    resolved = resolve_seer_run(
        run_id,
        organization,
        for_continue=True,
        user_id=identity_user.id,
    )
    if isinstance(resolved, Response):
        detail = resolved.data.get("detail") if isinstance(resolved.data, Mapping) else None
        return _respond_ephemeral(
            detail if isinstance(detail, str) else AGENT_WRITE_APPROVAL_UNAVAILABLE_MESSAGE
        )

    viewer_context = SeerViewerContext(
        organization_id=organization.id,
        user_id=identity_user.id,
    )
    try:
        state = fetch_run_status(
            resolved.seer_run_state_id,
            organization,
            viewer_context=viewer_context,
        )
    except (SeerApiError, AttributeError, TypeError, ValueError):
        _logger.exception(
            "seer.slack.agent_write_approval.state_fetch_failed",
            extra={"organization_id": organization.id, "run_id": run_id},
        )
        return _respond_ephemeral(AGENT_WRITE_APPROVAL_ERROR_MESSAGE)

    pending_input = state.pending_user_input
    if (
        state.status != "awaiting_user_input"
        or pending_input is None
        or pending_input.input_type != "agent_write_approval"
        or pending_input.id != input_id
    ):
        return _respond_ephemeral(AGENT_WRITE_APPROVAL_UNAVAILABLE_MESSAGE)

    approval = AgentApprovalRequestSerializer(
        data={
            "sessionId": pending_input.data.get("session_id"),
            "scopes": pending_input.data.get("required_scopes"),
        }
    )
    if not approval.is_valid():
        return _respond_ephemeral(AGENT_WRITE_APPROVAL_UNAVAILABLE_MESSAGE)

    validated_data = cast(AgentApprovalRequestData, approval.validated_data)
    session_id = validated_data["sessionId"]
    requested_scopes = validated_data["scopes"]
    if not requested_scopes:
        return _respond_ephemeral(AGENT_WRITE_APPROVAL_UNAVAILABLE_MESSAGE)

    response_data: dict[str, str] = {"decision": "reject"}
    approved = False
    if action == SlackAction.SEER_AGENT_WRITE_APPROVE:
        access = from_member(member)
        if not set(requested_scopes).issubset(access.scopes):
            return _respond_ephemeral(AGENT_WRITE_APPROVAL_INSUFFICIENT_MESSAGE)
        agent_token.create_write_grant(
            organization_id=organization.id,
            user_id=identity_user.id,
            session_id=session_id,
            scopes=requested_scopes,
        )
        approved = True
        response_data = {"decision": "approve"}

    update_body = AgentUpdateRequest(
        run_id=resolved.seer_run_state_id,
        organization_id=organization.id,
        payload={
            "type": "user_input_response",
            "input_id": pending_input.id,
            "response_data": response_data,
        },
    )
    response = make_agent_update_request(update_body, viewer_context=viewer_context)
    if response.status >= 400:
        _logger.warning(
            "seer.slack.agent_write_approval.response_failed",
            extra={
                "organization_id": organization.id,
                "run_id": run_id,
                "status": response.status,
            },
        )
        return _respond_ephemeral(AGENT_WRITE_APPROVAL_ERROR_MESSAGE)

    # The approval card can outlive the original context; refresh it for final delivery.
    SeerOperatorAgentCache[SlackAgentCachePayload].set(
        entrypoint_key=str(SeerEntrypointKey.SLACK),
        run_id=run_id,
        cache_payload=SlackAgentCachePayload(
            organization_id=organization.id,
            integration_id=slack_request.integration.id,
            thread={"channel_id": channel_id, "thread_ts": cached_message["thread_ts"]},
            slack_user_id=slack_user_id,
        ),
    )
    # Replace the card only after Seer accepts the input so a failed resume remains retryable.
    if not _update_agent_write_approval_message(
        slack_request=slack_request,
        organization_id=organization.id,
        run_id=run_id,
        approved=approved,
    ):
        return _respond_ephemeral(AGENT_WRITE_APPROVAL_ERROR_MESSAGE)
    _logger.info(
        "seer.slack.agent_write_approval.responded",
        extra={
            "organization_id": organization.id,
            "run_id": run_id,
            "user_id": identity_user.id,
            "decision": response_data["decision"],
        },
    )
    return Response()
