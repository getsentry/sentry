from __future__ import annotations

import logging
from collections.abc import Iterable

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.identity.services.identity.service import identity_service
from sentry.identity.slack.provider import PREFERRED_ORGANIZATION_ID_KEY
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.slack.message_builder.disconnected import SlackDisconnectedMessageBuilder
from sentry.integrations.slack.requests.base import SlackDMRequest, SlackRequestError
from sentry.integrations.slack.requests.command import SlackCommandRequest
from sentry.integrations.slack.utils.auth import is_valid_role
from sentry.integrations.slack.views.link_team import build_team_linking_url
from sentry.integrations.slack.views.unlink_team import build_team_unlinking_url
from sentry.integrations.types import ExternalProviders
from sentry.models.organization import OrganizationStatus
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam

_logger = logging.getLogger("sentry.integration.slack.bot-commands")

from .base import SlackDMEndpoint

LINK_TEAM_MESSAGE = (
    "Link your Sentry team to this Slack channel! <{associate_url}|Link your team now> to receive "
    "notifications of issues in Sentry in Slack."
)
LINK_USER_FIRST_MESSAGE = (
    "You must first link your identity to Sentry by typing /sentry link. Be aware that you "
    "must be an admin or higher in your Sentry organization or a team admin to link your team."
)
LINK_FROM_CHANNEL_MESSAGE = "You must type this command in a channel, not a DM."
UNLINK_TEAM_MESSAGE = "<{associate_url}|Click here to unlink your team from this channel.>"
TEAM_NOT_LINKED_MESSAGE = "No team is linked to this channel."
DIRECT_MESSAGE_CHANNEL_NAME = "directmessage"
INSUFFICIENT_ROLE_MESSAGE = (
    "You must be a Sentry organization admin/manager/owner or a team admin to link or unlink teams."
)
NO_USER_ID_MESSAGE = "Could not identify your Slack user ID. Please try again."
NO_CHANNEL_ID_MESSAGE = "Could not identify the Slack channel ID. Please try again."
SET_DEFAULT_ORG_MISSING_SLUG_MESSAGE = "Which org? Try `/sentry set org <slug>`."
SET_DEFAULT_ORG_NOT_FOUND_PREFIX = (
    "Hmm, couldn't find an organization that you belong to with the slug"
)
SET_DEFAULT_ORG_NOT_FOUND_MESSAGE = SET_DEFAULT_ORG_NOT_FOUND_PREFIX + " `{slug}`."
SET_DEFAULT_ORG_SUCCESS_MESSAGE = "Got it — your default organization is now `{slug}`."
UNSET_DEFAULT_ORG_SUCCESS_MESSAGE = "All set — your default organization has been cleared."


def get_orgs_with_teams_linked_to_channel(
    organization_ids: list[int], slack_request: SlackDMRequest
) -> set[int]:
    """Get the organizations with teams linked to a Slack channel"""
    return set(
        ExternalActor.objects.filter(
            organization_id__in=organization_ids,
            integration_id=slack_request.integration.id,
            provider=ExternalProviders.SLACK.value,
            external_name=slack_request.channel_name,
            external_id=slack_request.channel_id,
        ).values_list("organization_id", flat=True)
    )


def get_team_admin_member_ids(org_members: Iterable[OrganizationMember]) -> set[int]:
    return set(
        OrganizationMemberTeam.objects.filter(
            organizationmember_id__in=[om.id for om in org_members], role="admin"
        ).values_list("organizationmember_id", flat=True)
    )


@cell_silo_endpoint
class SlackCommandsEndpoint(SlackDMEndpoint):
    owner = ApiOwner.MESSAGING_INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()
    slack_request_class = SlackCommandRequest

    def reply(self, slack_request: SlackDMRequest, message: str) -> Response:
        return self.respond(
            {
                "response_type": "ephemeral",
                "replace_original": False,
                "text": message,
            }
        )

    def link_team(self, slack_request: SlackDMRequest) -> Response:
        if slack_request.channel_name == DIRECT_MESSAGE_CHANNEL_NAME:
            return self.reply(slack_request, LINK_FROM_CHANNEL_MESSAGE)

        logger_params: dict[str, int] = {}

        identity_user = slack_request.get_identity_user()
        if not identity_user:
            _logger.info("no-identity-user", extra=logger_params)
            return self.reply(slack_request, LINK_USER_FIRST_MESSAGE)

        integration = slack_request.integration
        logger_params["integration_id"] = integration.id
        organization_memberships = OrganizationMember.objects.get_for_integration(
            integration, identity_user
        )

        # Batch check for team admin roles to avoid N+1 queries
        team_admin_member_ids = get_team_admin_member_ids(organization_memberships)

        has_valid_role = False
        for organization_membership in organization_memberships:
            if (
                is_valid_role(organization_membership)
                or organization_membership.id in team_admin_member_ids
            ):
                has_valid_role = True
                break

        if not has_valid_role:
            return self.reply(slack_request, INSUFFICIENT_ROLE_MESSAGE)

        if not slack_request.user_id:
            return self.reply(slack_request, NO_USER_ID_MESSAGE)

        if not slack_request.channel_id:
            return self.reply(slack_request, NO_CHANNEL_ID_MESSAGE)

        associate_url = build_team_linking_url(
            integration=integration,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            channel_name=slack_request.channel_name,
            response_url=slack_request.response_url,
        )

        return self.reply(slack_request, LINK_TEAM_MESSAGE.format(associate_url=associate_url))

    def unlink_team(self, slack_request: SlackDMRequest) -> Response:
        if slack_request.channel_name == DIRECT_MESSAGE_CHANNEL_NAME:
            return self.reply(slack_request, LINK_FROM_CHANNEL_MESSAGE)

        identity_user = slack_request.get_identity_user()
        if not identity_user:
            return self.reply(slack_request, LINK_USER_FIRST_MESSAGE)

        integration = slack_request.integration
        organization_memberships = OrganizationMember.objects.get_for_integration(
            integration, identity_user
        )

        # Batch check which organizations have teams linked to this channel
        linked_org_ids = get_orgs_with_teams_linked_to_channel(
            [om.organization_id for om in organization_memberships], slack_request
        )

        if not linked_org_ids:
            return self.reply(slack_request, TEAM_NOT_LINKED_MESSAGE)

        # Batch check for team admin roles to avoid N+1 queries
        team_admin_member_ids = get_team_admin_member_ids(organization_memberships)

        # Find an organization where user has both a linked team AND sufficient permissions
        found: OrganizationMember | None = None
        for organization_membership in organization_memberships:
            if organization_membership.organization_id in linked_org_ids:
                if (
                    is_valid_role(organization_membership)
                    or organization_membership.id in team_admin_member_ids
                ):
                    found = organization_membership
                    break

        if not found:
            return self.reply(slack_request, INSUFFICIENT_ROLE_MESSAGE)

        if not slack_request.user_id:
            return self.reply(slack_request, NO_USER_ID_MESSAGE)

        if not slack_request.channel_id:
            return self.reply(slack_request, NO_CHANNEL_ID_MESSAGE)

        associate_url = build_team_unlinking_url(
            integration=integration,
            organization_id=found.organization.id,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            channel_name=slack_request.channel_name,
            response_url=slack_request.response_url,
        )

        return self.reply(slack_request, UNLINK_TEAM_MESSAGE.format(associate_url=associate_url))

    def set_default_org(self, slack_request: SlackDMRequest, slug: str) -> Response:
        identity = slack_request.get_identity()
        identity_user = slack_request.get_identity_user()
        if not identity or not identity_user:
            return self.reply(slack_request, LINK_USER_FIRST_MESSAGE)

        slug = slug.strip()
        if not slug:
            return self.reply(slack_request, SET_DEFAULT_ORG_MISSING_SLUG_MESSAGE)

        membership = (
            OrganizationMember.objects.get_for_integration(slack_request.integration, identity_user)
            .filter(
                organization__slug=slug,
                organization__status=OrganizationStatus.ACTIVE,
                invite_status=InviteStatus.APPROVED.value,
            )
            .first()
        )
        if membership is None:
            return self.reply(slack_request, SET_DEFAULT_ORG_NOT_FOUND_MESSAGE.format(slug=slug))

        new_data = {**identity.data, PREFERRED_ORGANIZATION_ID_KEY: membership.organization_id}
        identity_service.update_data(identity_id=identity.id, data=new_data)

        return self.reply(slack_request, SET_DEFAULT_ORG_SUCCESS_MESSAGE.format(slug=slug))

    def unset_default_org(self, slack_request: SlackDMRequest) -> Response:
        identity = slack_request.get_identity()
        if not identity:
            return self.reply(slack_request, LINK_USER_FIRST_MESSAGE)

        if PREFERRED_ORGANIZATION_ID_KEY in identity.data:
            new_data = {
                k: v for k, v in identity.data.items() if k != PREFERRED_ORGANIZATION_ID_KEY
            }
            identity_service.update_data(identity_id=identity.id, data=new_data)

        return self.reply(slack_request, UNSET_DEFAULT_ORG_SUCCESS_MESSAGE)

    def post(self, request: Request) -> Response:
        try:
            slack_request = self.slack_request_class(request)
            slack_request.validate()
        except SlackRequestError as e:
            if e.status == status.HTTP_403_FORBIDDEN:
                return self.respond(SlackDisconnectedMessageBuilder().build())
            return self.respond(status=e.status)

        return super().post_dispatcher(slack_request)
