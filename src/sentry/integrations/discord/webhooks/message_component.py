from __future__ import annotations

from rest_framework.response import Response

from sentry.api.helpers.group_index.update import update_groups
from sentry.integrations.discord.message_builder.base.base import DiscordMessageBuilder
from sentry.integrations.discord.message_builder.base.component.action_row import DiscordActionRow
from sentry.integrations.discord.message_builder.base.component.select_menu import (
    DiscordSelectMenu,
    DiscordSelectMenuOption,
)
from sentry.integrations.discord.message_builder.base.flags import DiscordMessageFlags
from sentry.integrations.discord.requests.base import DiscordRequest
from sentry.integrations.discord.webhooks.handler import DiscordInteractionHandler
from sentry.models.activity import ActivityIntegration
from sentry.models.group import Group
from sentry.services.hybrid_cloud.user.model import RpcUser

from ..utils import logger

NO_IDENTITY_MESSAGE = "Sorry! You need to link your Discord account to your Sentry account to do that. You can do this with `/link`!"
NOT_IN_ORG = "Sorry! You must be a member of the org this issue belongs to in order to act on it."


class DiscordMessageComponentHandler(DiscordInteractionHandler):
    """
    Handles logic for Discord Message Component interactions.

    Request passed in constructor must be a Message Component interaction.
    """

    def __init__(self, request: DiscordRequest) -> None:
        super().__init__(request)
        self.custom_id: str = request.get_component_custom_id()
        self.user: RpcUser
        # Everything after the colon is the group id in a custom_id
        self.group_id: str = self.custom_id.split(":")[1]
        self.group: Group = Group.objects.get(id=self.group_id)

    def handle(self) -> Response:
        logging_data = self.request.logging_data

        if self.request.user is None:
            logger.info("discord.interaction.component.not_linked", extra={**logging_data})
            return self.send_error(NO_IDENTITY_MESSAGE)
        self.user = self.request.user

        if not self.group.organization.has_access(self.user):
            logger.info(
                "discord.interaction.component.not_in_org",
                extra={"org_slug": self.group.organization.slug, **logging_data},
            )
            return self.send_error(NOT_IN_ORG)

        if self.custom_id.startswith("assign:"):
            logger.info("discord.interaction.component.assign_dialog", extra={**logging_data})
            return self.assign_dialog()

        elif self.custom_id.startswith("assign_to:"):
            logger.info(
                "discord.interaction.component.assign",
                extra={**logging_data, "assign_to": self.request.get_selected_options()[0]},
            )
            return self.assign_to()

        return Response(status=400)

    def assign_dialog(self) -> Response:
        assign_selector = DiscordSelectMenu(
            custom_id=f"assign_to:{self.group_id}",
            placeholder="Select Assignee...",
            options=get_assign_selector_options(self.group),
        )
        message = DiscordMessageBuilder(
            components=[DiscordActionRow([assign_selector])],
            flags=DiscordMessageFlags().set_ephemeral(),
        )
        return self.send_message(message)

    def assign_to(self) -> Response:
        assignee = self.request.get_selected_options()[0]

        update_groups(
            request=self.request.request,
            group_ids=[self.group.id],
            projects=[self.group.project],
            organization_id=self.group.organization.id,
            search_fn=None,
            user=self.user,
            data={
                "assignedTo": assignee,
                "integration": ActivityIntegration.DISCORD.value,
            },
        )

        message = DiscordMessageBuilder(
            content="Assignee has been updated!",
            flags=DiscordMessageFlags().set_ephemeral(),
        )
        return self.update_message(message)


def get_assign_selector_options(group: Group) -> list[DiscordSelectMenuOption]:
    """
    Helper function for building the new assignee dropdown.

    Placeholder in the dropdown will be the current assignee.
    """
    all_members = group.project.get_members_as_rpc_users()
    members = list({m.id: m for m in all_members}.values())
    teams = group.project.teams.all()

    assignee = group.get_assignee()

    options = []
    # We don't have the luxury of option groups like Slack has, so we will just
    # list all the teams and then all the members.
    if teams:
        team_options = [
            DiscordSelectMenuOption(
                label=f"#{team.slug}", value=f"team:{team.id}", default=(team == assignee)
            )
            for team in teams
        ]
        options.extend(sorted(team_options, key=lambda t: t.label))
    if members:
        member_options = [
            DiscordSelectMenuOption(
                label=member.get_display_name(),
                value=f"user:{member.id}",
                default=(member == assignee),
            )
            for member in members
        ]
        options.extend(sorted(member_options, key=lambda m: m.label))

    return options
