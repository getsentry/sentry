from __future__ import annotations

import logging
from collections.abc import Mapping
from enum import StrEnum
from typing import Any

import orjson
from rest_framework.response import Response

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.requests.action import SlackActionRequest
from sentry.investigations.endpoints.base import organization_project_ids
from sentry.investigations.services import (
    InvestigationSourceNotFound,
    InvestigationValidationError,
    resolve_investigation_source,
)
from sentry.models.organization import Organization
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.seer.entrypoints.operator import SeerInvestigationOperator
from sentry.seer.entrypoints.slack.entrypoint import (
    SlackInvestigationEntrypoint,
)
from sentry.seer.entrypoints.types import SeerEntrypointKey
from sentry.users.services.user import RpcUser

logger = logging.getLogger(__name__)

INVESTIGATION_SCOPES = frozenset({"org:read", "org:write", "org:admin"})
INVESTIGATION_UNAVAILABLE_MESSAGE = "Seer can't start an investigation for this alert."
INVESTIGATION_NOT_MEMBER_MESSAGE = (
    "You must be a member of the *{org_name}* Sentry organization to start a Seer investigation."
)
INVESTIGATION_EXISTS_MESSAGE = (
    "Seer is already investigating this alert. <{link}|View investigation>"
)


class InvestigationUnavailableReason(StrEnum):
    MISSING_ORGANIZATION_ID = "missing_organization_id"
    MISSING_MESSAGE_CONTAINER = "missing_message_container"
    MISSING_SLACK_USER = "missing_slack_user"
    INACTIVE_USER = "inactive_user"
    INTEGRATION_NOT_INSTALLED = "integration_not_installed"
    ORGANIZATION_NOT_FOUND = "organization_not_found"
    NO_ACCESS = "no_access"
    CLOSED_MEMBERSHIP = "closed_membership"
    MISSING_SCOPE = "missing_scope"
    INVALID_ACTION = "invalid_action"
    SOURCE_NOT_FOUND = "source_not_found"
    INVALID_SOURCE = "invalid_source"


def _respond_ephemeral(text: str) -> Response:
    return Response({"response_type": "ephemeral", "replace_original": False, "text": text})


class InvestigationActionError(Exception):
    pass


class MissingInvestigationAction(InvestigationActionError):
    pass


class InvalidInvestigationActionValue(InvestigationActionError):
    pass


def _get_investigation_source(slack_request: SlackActionRequest) -> dict[str, Any]:
    actions = slack_request.data.get("actions")
    if not isinstance(actions, list) or not actions or not isinstance(actions[0], Mapping):
        raise MissingInvestigationAction("Request has no actions")
    value = actions[0].get("value")
    if not isinstance(value, str):
        raise InvalidInvestigationActionValue(
            f"Expected a string value, got {type(value).__name__}"
        )
    try:
        ref = orjson.loads(value)
    except orjson.JSONDecodeError as e:
        raise InvalidInvestigationActionValue("Value is not valid JSON") from e
    return {"type": "metric_open_period", "ref": ref}


def handle_seer_investigation_start(
    *,
    slack_request: SlackActionRequest,
    organization_id: int | None,
    identity_user: RpcUser,
) -> Response:
    def log_unavailable(
        reason: InvestigationUnavailableReason, extra: Mapping[str, Any] | None = None
    ) -> None:
        logger.warning(
            "slack.investigation.start_unavailable",
            extra={
                "reason": reason,
                "organization_id": organization_id,
                "integration_id": slack_request.integration.id,
                **(extra or {}),
            },
        )

    if organization_id is None:
        log_unavailable(InvestigationUnavailableReason.MISSING_ORGANIZATION_ID)
        return _respond_ephemeral(INVESTIGATION_UNAVAILABLE_MESSAGE)
    container = slack_request.data.get("container")
    channel_id = container.get("channel_id") if isinstance(container, Mapping) else None
    message_ts = container.get("message_ts") if isinstance(container, Mapping) else None
    if not isinstance(channel_id, str) or not isinstance(message_ts, str):
        log_unavailable(InvestigationUnavailableReason.MISSING_MESSAGE_CONTAINER)
        return _respond_ephemeral(INVESTIGATION_UNAVAILABLE_MESSAGE)
    slack_user_id = slack_request.user_id
    if slack_user_id is None:
        log_unavailable(InvestigationUnavailableReason.MISSING_SLACK_USER)
        return _respond_ephemeral(INVESTIGATION_UNAVAILABLE_MESSAGE)
    if not identity_user.is_active or identity_user.is_suspended:
        log_unavailable(InvestigationUnavailableReason.INACTIVE_USER)
        return _respond_ephemeral(INVESTIGATION_UNAVAILABLE_MESSAGE)

    organization_integrations = integration_service.get_organization_integrations(
        integration_id=slack_request.integration.id,
        organization_id=organization_id,
        status=ObjectStatus.ACTIVE,
        limit=1,
    )
    if not organization_integrations:
        log_unavailable(InvestigationUnavailableReason.INTEGRATION_NOT_INSTALLED)
        return _respond_ephemeral(INVESTIGATION_UNAVAILABLE_MESSAGE)

    organization = Organization.objects.filter(id=organization_id).first()
    if organization is None:
        log_unavailable(InvestigationUnavailableReason.ORGANIZATION_NOT_FOUND)
        return _respond_ephemeral(INVESTIGATION_UNAVAILABLE_MESSAGE)
    if not SeerInvestigationOperator.has_access(
        organization=organization, entrypoint_key=SeerEntrypointKey.SLACK
    ):
        log_unavailable(InvestigationUnavailableReason.NO_ACCESS)
        return _respond_ephemeral(INVESTIGATION_UNAVAILABLE_MESSAGE)

    member = OrganizationMember.objects.filter(
        user_id=identity_user.id,
        organization_id=organization.id,
        invite_status=InviteStatus.APPROVED.value,
    ).first()
    if member is None:
        return _respond_ephemeral(
            INVESTIGATION_NOT_MEMBER_MESSAGE.format(org_name=organization.name)
        )
    if not organization.flags.allow_joinleave:
        log_unavailable(InvestigationUnavailableReason.CLOSED_MEMBERSHIP)
        return _respond_ephemeral(INVESTIGATION_UNAVAILABLE_MESSAGE)
    # Matches InvestigationPermission, so a role like billing can't start a run it can't open.
    if not member.get_scopes() & INVESTIGATION_SCOPES:
        log_unavailable(InvestigationUnavailableReason.MISSING_SCOPE)
        return _respond_ephemeral(INVESTIGATION_UNAVAILABLE_MESSAGE)

    try:
        source = _get_investigation_source(slack_request)
    except InvestigationActionError as e:
        log_unavailable(
            InvestigationUnavailableReason.INVALID_ACTION,
            {"error_type": type(e).__name__, "error": str(e)},
        )
        return _respond_ephemeral(INVESTIGATION_UNAVAILABLE_MESSAGE)
    try:
        resolved_source = resolve_investigation_source(
            organization=organization,
            source=source,
            accessible_project_ids=organization_project_ids(organization),
        )
    except InvestigationSourceNotFound:
        log_unavailable(InvestigationUnavailableReason.SOURCE_NOT_FOUND)
        return _respond_ephemeral(INVESTIGATION_UNAVAILABLE_MESSAGE)
    except InvestigationValidationError as e:
        log_unavailable(InvestigationUnavailableReason.INVALID_SOURCE, {"error": str(e)})
        return _respond_ephemeral(INVESTIGATION_UNAVAILABLE_MESSAGE)

    entrypoint = SlackInvestigationEntrypoint(
        slack_request=slack_request,
        organization=organization,
        channel_id=channel_id,
        message_ts=message_ts,
        slack_user_id=slack_user_id,
    )
    result = SeerInvestigationOperator(entrypoint=entrypoint).trigger_investigation(
        organization=organization,
        user_id=identity_user.id,
        resolved_source=resolved_source,
    )
    if result is None:
        return Response()

    investigation, created = result
    if not created:
        return _respond_ephemeral(
            INVESTIGATION_EXISTS_MESSAGE.format(link=investigation.get_absolute_url())
        )
    return Response()
