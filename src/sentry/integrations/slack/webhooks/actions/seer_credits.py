from __future__ import annotations

import logging

from rest_framework.response import Response

from sentry import seer_credit
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.requests.action import SlackActionRequest
from sentry.models.organization import Organization
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.users.services.user import RpcUser

_logger = logging.getLogger(__name__)

REQUEST_CREDITS_SENT_MESSAGE = ":white_check_mark: Your admins have been notified."
REQUEST_CREDITS_ALREADY_SENT_MESSAGE = "You've already asked your admins this billing period."
REQUEST_CREDITS_UNAVAILABLE_MESSAGE = "Sentry can't notify your admins right now."
REQUEST_CREDITS_NOT_MEMBER_MESSAGE = (
    "You must be a member of the *{org_name}* Sentry organization to contact its admins."
)


def _respond_ephemeral(text: str) -> Response:
    return Response({"response_type": "ephemeral", "replace_original": False, "text": text})


def handle_seer_request_credits(
    *,
    slack_request: SlackActionRequest,
    organization_id: int | None,
    identity_user: RpcUser,
) -> Response:
    """
    Asks the organization's billing admins for more Seer credits, on behalf of the
    member who clicked "Contact Admin" on an out-of-credits notice.
    """
    if organization_id is None or not identity_user.is_active or identity_user.is_suspended:
        return _respond_ephemeral(REQUEST_CREDITS_UNAVAILABLE_MESSAGE)

    # The organization comes from the button, so check it against the workspace the click came from.
    organization_integrations = integration_service.get_organization_integrations(
        integration_id=slack_request.integration.id,
        organization_id=organization_id,
        status=ObjectStatus.ACTIVE,
        limit=1,
    )
    if not organization_integrations:
        return _respond_ephemeral(REQUEST_CREDITS_UNAVAILABLE_MESSAGE)

    organization = Organization.objects.filter(id=organization_id).first()
    if organization is None:
        return _respond_ephemeral(REQUEST_CREDITS_UNAVAILABLE_MESSAGE)

    is_member = OrganizationMember.objects.filter(
        user_id=identity_user.id,
        organization_id=organization.id,
        invite_status=InviteStatus.APPROVED.value,
    ).exists()
    if not is_member:
        return _respond_ephemeral(
            REQUEST_CREDITS_NOT_MEMBER_MESSAGE.format(org_name=organization.name)
        )

    try:
        requested = seer_credit.backend.request_top_up(organization, identity_user)
    except Exception:
        _logger.exception(
            "seer.slack.request_credits.failed",
            extra={"organization_id": organization.id, "user_id": identity_user.id},
        )
        return _respond_ephemeral(REQUEST_CREDITS_UNAVAILABLE_MESSAGE)

    _logger.info(
        "seer.slack.request_credits",
        extra={
            "organization_id": organization.id,
            "user_id": identity_user.id,
            "requested": requested,
        },
    )
    # The notice keeps its button, so the answer goes only to whoever clicked.
    return _respond_ephemeral(
        REQUEST_CREDITS_SENT_MESSAGE if requested else REQUEST_CREDITS_ALREADY_SENT_MESSAGE
    )
