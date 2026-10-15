from __future__ import annotations

from collections.abc import Mapping
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

INVESTIGATION_UNAVAILABLE_MESSAGE = "Seer can't start an investigation for this alert."
INVESTIGATION_NOT_MEMBER_MESSAGE = (
    "You must be a member of the *{org_name}* Sentry organization to start a Seer investigation."
)
INVESTIGATION_EXISTS_MESSAGE = (
    "Seer is already investigating this alert. <{link}|View investigation>"
)


def _respond_ephemeral(text: str) -> Response:
    return Response({"response_type": "ephemeral", "replace_original": False, "text": text})


def _get_investigation_source(slack_request: SlackActionRequest) -> dict[str, Any] | None:
    actions = slack_request.data.get("actions")
    if not isinstance(actions, list) or not actions or not isinstance(actions[0], Mapping):
        return None
    value = actions[0].get("value")
    if not isinstance(value, str):
        return None
    try:
        ref = orjson.loads(value)
    except orjson.JSONDecodeError:
        return None
    return {"type": "metric_open_period", "ref": ref}


def handle_seer_investigation_start(
    *,
    slack_request: SlackActionRequest,
    organization_id: int | None,
    identity_user: RpcUser,
) -> Response:
    container = slack_request.data.get("container")
    channel_id = container.get("channel_id") if isinstance(container, Mapping) else None
    message_ts = container.get("message_ts") if isinstance(container, Mapping) else None
    slack_user_id = slack_request.user_id
    if (
        organization_id is None
        or not isinstance(channel_id, str)
        or not isinstance(message_ts, str)
        or slack_user_id is None
        or not identity_user.is_active
        or identity_user.is_suspended
    ):
        return _respond_ephemeral(INVESTIGATION_UNAVAILABLE_MESSAGE)

    organization_integrations = integration_service.get_organization_integrations(
        integration_id=slack_request.integration.id,
        organization_id=organization_id,
        status=ObjectStatus.ACTIVE,
        limit=1,
    )
    if not organization_integrations:
        return _respond_ephemeral(INVESTIGATION_UNAVAILABLE_MESSAGE)

    organization = Organization.objects.filter(id=organization_id).first()
    if organization is None or not SeerInvestigationOperator.has_access(
        organization=organization, entrypoint_key=SeerEntrypointKey.SLACK
    ):
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
        return _respond_ephemeral(INVESTIGATION_UNAVAILABLE_MESSAGE)

    source = _get_investigation_source(slack_request)
    if source is None:
        return _respond_ephemeral(INVESTIGATION_UNAVAILABLE_MESSAGE)
    try:
        resolved_source = resolve_investigation_source(
            organization=organization,
            source=source,
            accessible_project_ids=organization_project_ids(organization),
        )
    except (InvestigationSourceNotFound, InvestigationValidationError):
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
