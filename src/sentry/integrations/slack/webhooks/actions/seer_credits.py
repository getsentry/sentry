from __future__ import annotations

import logging
from collections.abc import Mapping
from urllib.error import URLError

from rest_framework.response import Response
from slack_sdk.errors import SlackRequestError
from slack_sdk.models.blocks import ContextBlock, MarkdownTextObject
from slack_sdk.webhook import WebhookClient

from sentry import seer_credit
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.requests.action import SlackActionRequest
from sentry.models.organization import Organization
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.users.services.user import RpcUser
from sentry.utils.cache import cache

_logger = logging.getLogger(__name__)

REQUEST_CREDITS_SENT_MESSAGE = ":white_check_mark: Your admins have been notified."
REQUEST_CREDITS_UNAVAILABLE_MESSAGE = "Sentry can't notify your admins right now."
REQUEST_CREDITS_NOT_MEMBER_MESSAGE = (
    "You must be a member of the *{org_name}* Sentry organization to contact its admins."
)

# A thread can hold many out-of-credits notices, each with its own button, so
# one person's clicks reach the admins once in this many seconds.
REQUEST_CREDITS_COOLDOWN = 24 * 60 * 60


def _respond_ephemeral(text: str) -> Response:
    return Response({"response_type": "ephemeral", "replace_original": False, "text": text})


def _cooldown_key(*, organization_id: int, user_id: int) -> str:
    return f"seer:slack:request-credits:{organization_id}:{user_id}"


def _replace_button_with_confirmation(
    *, slack_request: SlackActionRequest, organization_id: int
) -> None:
    """Swaps the notice's button for a confirmation, for everyone in the thread to see."""
    message = slack_request.data.get("message")
    if not isinstance(message, Mapping):
        return
    blocks = [block for block in message.get("blocks", []) if block.get("type") != "actions"]
    blocks.append(
        ContextBlock(elements=[MarkdownTextObject(text=REQUEST_CREDITS_SENT_MESSAGE)]).to_dict()
    )
    try:
        response = WebhookClient(slack_request.response_url).send(
            text=message.get("text", ""),
            blocks=blocks,
            replace_original=True,
        )
    except (SlackRequestError, URLError, TimeoutError, ConnectionResetError):
        _logger.exception(
            "seer.slack.request_credits.message_update_failed",
            extra={"organization_id": organization_id},
        )
        return
    if response.status_code >= 400:
        _logger.warning(
            "seer.slack.request_credits.message_update_failed",
            extra={"organization_id": organization_id, "status": response.status_code},
        )


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

    cooldown_key = _cooldown_key(organization_id=organization.id, user_id=identity_user.id)
    if cache.add(cooldown_key, True, timeout=REQUEST_CREDITS_COOLDOWN):
        try:
            seer_credit.backend.request_top_up(organization, identity_user)
        except Exception:
            # Nobody was asked, so let the next click try again.
            cache.delete(cooldown_key)
            _logger.exception(
                "seer.slack.request_credits.failed",
                extra={"organization_id": organization.id, "user_id": identity_user.id},
            )
            return _respond_ephemeral(REQUEST_CREDITS_UNAVAILABLE_MESSAGE)
        _logger.info(
            "seer.slack.request_credits.sent",
            extra={"organization_id": organization.id, "user_id": identity_user.id},
        )

    _replace_button_with_confirmation(slack_request=slack_request, organization_id=organization.id)
    return Response()
