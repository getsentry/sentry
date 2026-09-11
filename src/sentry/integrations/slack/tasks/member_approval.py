from __future__ import annotations

import logging

from django.urls import reverse
from slack_sdk.webhook import WebhookClient

from sentry import analytics
from sentry.auth.access import from_member
from sentry.exceptions import UnableToAcceptMemberInvitationException
from sentry.integrations.slack.analytics import (
    SlackIntegrationApproveMemberInvitation,
    SlackIntegrationRejectMemberInvitation,
)
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks
from sentry.users.services.user.service import user_service

logger = logging.getLogger(__name__)

NO_ACCESS_MESSAGE = "You do not have access to the organization for the invitation."
NO_PERMISSION_MESSAGE = "You do not have permission to approve member invitations."
DEFAULT_ERROR_MESSAGE = "Sentry can't perform that action right now on your behalf!"
SUCCESS_MESSAGE = (
    "{invite_type} request for {email} has been {verb}. <{url}|See Members and Requests>."
)


def _send_response(webhook_client: WebhookClient, text: str) -> None:
    webhook_client.send(text=text, response_type="in_channel", replace_original=False)


@instrumented_task(
    name="sentry.integrations.slack.tasks.process_member_approval",
    namespace=integrations_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.CELL,
)
def process_member_approval(
    *,
    member_id: int,
    member_email: str,
    actor_id: int,
    response_url: str,
    action: str,
) -> None:
    if not response_url:
        logger.warning(
            "slack.action.member-approval-no-response-url",
            extra={"member_id": member_id, "actor_id": actor_id},
        )
        return

    webhook_client = WebhookClient(response_url)
    actor = user_service.get_user(user_id=actor_id)
    if actor is None:
        _send_response(webhook_client, DEFAULT_ERROR_MESSAGE)
        return

    try:
        member = OrganizationMember.objects.get_member_invite_query(member_id).get()
    except OrganizationMember.DoesNotExist:
        _send_response(webhook_client, f"Member invitation for {member_email} no longer exists.")
        return

    organization = member.organization
    if not organization.has_access(actor):
        _send_response(webhook_client, NO_ACCESS_MESSAGE)
        return

    try:
        member_of_approver = OrganizationMember.objects.get(
            user_id=actor.id, organization=organization
        )
    except OrganizationMember.DoesNotExist:
        logger.warning(
            "slack.action.member-approver-no-longer-exists",
            extra={
                "organization_id": organization.id,
                "member_id": member.id,
                "actor_id": actor.id,
            },
        )
        _send_response(webhook_client, NO_ACCESS_MESSAGE)
        return

    access = from_member(member_of_approver)
    if not access.has_scope("member:admin"):
        _send_response(webhook_client, NO_PERMISSION_MESSAGE)
        return

    allowed_roles = member_of_approver.get_allowed_org_roles_to_invite()
    try:
        member.validate_invitation(actor, allowed_roles)
    except UnableToAcceptMemberInvitationException as err:
        _send_response(webhook_client, str(err))
        return

    original_status = InviteStatus(member.invite_status)
    try:
        if action == "approve_member":
            member.approve_member_invitation(actor, referrer=IntegrationProviderSlug.SLACK.value)
        else:
            member.reject_member_invitation(actor)
    except Exception:
        logger.warning(
            "slack.action.member-invitation-error",
            extra={
                "organization_id": organization.id,
                "member_id": member.id,
            },
        )
        _send_response(webhook_client, DEFAULT_ERROR_MESSAGE)
        return

    invite_type = "Invite" if original_status == InviteStatus.REQUESTED_TO_BE_INVITED else "Join"
    if action == "approve_member":
        event = SlackIntegrationApproveMemberInvitation(
            actor_id=actor.id,
            organization_id=member.organization_id,
            invitation_type=invite_type.lower(),
            invited_member_id=member.id,
        )
        verb = "approved"
    else:
        event = SlackIntegrationRejectMemberInvitation(
            actor_id=actor.id,
            organization_id=member.organization_id,
            invitation_type=invite_type.lower(),
            invited_member_id=member.id,
        )
        verb = "rejected"

    analytics.record(event)
    manage_url = member.organization.absolute_url(
        reverse("sentry-organization-members", args=[member.organization.slug])
    )
    _send_response(
        webhook_client,
        SUCCESS_MESSAGE.format(
            email=member.email,
            invite_type=invite_type,
            url=manage_url,
            verb=verb,
        ),
    )
