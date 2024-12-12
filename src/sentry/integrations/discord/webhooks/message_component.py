from __future__ import annotations

from collections.abc import Mapping
from functools import cached_property

from rest_framework.response import Response

from sentry import analytics
from sentry.api.helpers.group_index.update import update_groups
from sentry.integrations.discord.message_builder.base.base import DiscordMessageBuilder
from sentry.integrations.discord.message_builder.base.component import (
    DiscordComponentCustomIds as CustomIds,
)
from sentry.integrations.discord.message_builder.base.component.action_row import DiscordActionRow
from sentry.integrations.discord.message_builder.base.component.select_menu import (
    DiscordSelectMenu,
    DiscordSelectMenuOption,
)
from sentry.integrations.discord.message_builder.base.flags import DiscordMessageFlags
from sentry.integrations.discord.requests.base import DiscordRequest
from sentry.integrations.discord.spec import DiscordMessagingSpec
from sentry.integrations.discord.webhooks.handler import DiscordInteractionHandler
from sentry.integrations.messaging.metrics import (
    MessagingInteractionEvent,
    MessagingInteractionType,
)
from sentry.models.activity import ActivityIntegration
from sentry.models.group import Group
from sentry.models.grouphistory import STATUS_TO_STRING_LOOKUP, GroupHistoryStatus
from sentry.types.group import SUBSTATUS_TO_STR, GroupSubStatus
from sentry.users.services.user.model import RpcUser

from ..utils import logger

NO_IDENTITY = "You need to link your Discord account to your Sentry account to do that. You can do this with `/link`."
NOT_IN_ORG = "You must be a member of the org this issue belongs to in order to act on it."
ASSIGNEE_UPDATED = "Assignee has been updated."
RESOLVE_DIALOG_OPTIONS = [
    DiscordSelectMenuOption("Immediately", "immediately"),
    DiscordSelectMenuOption("In the next release", "inNextRelease"),
    DiscordSelectMenuOption("In the current release", "inCurrentRelease"),
]
RESOLVED = "The issue has been resolved."
RESOLVED_IN_NEXT_RELEASE = "The issue will be resolved in the next release."
RESOLVED_IN_CURRENT_RELEASE = "The issue will be resolved in the current release."
UNRESOLVED = "The issue has been unresolved."
MARKED_ONGOING = "The issue has been marked as ongoing."
ARCHIVE_UNTIL_ESCALATES = "The issue will be archived until it escalates."
INVALID_GROUP_ID = "Invalid group ID."


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
        custom_id_parts = self.custom_id.split(":")
        self.group_id: str = custom_id_parts[1] if len(custom_id_parts) > 1 else ""

    @cached_property
    def group(self) -> Group | None:
        try:
            group_id = int(self.group_id)
            return Group.objects.filter(id=group_id).first()
        except Exception:
            return None

    def handle(self) -> Response:
        logging_data = self.request.logging_data

        if self.request.user is None:
            logger.warning("discord.interaction.component.not_linked", extra={**logging_data})
            return self.send_message(NO_IDENTITY)
        self.user = self.request.user

        if (not self.group_id) or (not self.group):
            return self.send_message(INVALID_GROUP_ID)

        if not self.group.organization.has_access(self.user):
            logger.warning(
                "discord.interaction.component.not_in_org",
                extra={"org_slug": self.group.organization.slug, **logging_data},
            )
            return self.send_message(NOT_IN_ORG)

        def record_event(interaction_type: MessagingInteractionType) -> MessagingInteractionEvent:
            return MessagingInteractionEvent(
                interaction_type,
                DiscordMessagingSpec(),
                user=self.user,
                organization=(self.group.organization if self.group else None),
            )

        if self.custom_id.startswith(CustomIds.ASSIGN_DIALOG):
            logger.info("discord.interaction.component.assign_dialog", extra={**logging_data})
            with record_event(MessagingInteractionType.ASSIGN_DIALOG).capture():
                return self.assign_dialog()

        elif self.custom_id.startswith(CustomIds.ASSIGN):
            logger.info(
                "discord.interaction.component.assign",
                extra={**logging_data, "assign_to": self.request.get_selected_options()[0]},
            )
            with record_event(MessagingInteractionType.ASSIGN).capture():
                return self.assign()

        elif self.custom_id.startswith(CustomIds.RESOLVE_DIALOG):
            logger.info("discord.interaction.component.resolve_dialog", extra={**logging_data})
            with record_event(MessagingInteractionType.RESOLVE_DIALOG).capture():
                return self.resolve_dialog()

        elif self.custom_id.startswith(CustomIds.RESOLVE):
            logger.info("discord.interaction.component.resolve", extra={**logging_data})
            with record_event(MessagingInteractionType.RESOLVE).capture():
                return self.resolve()

        elif self.custom_id.startswith(CustomIds.UNRESOLVE):
            logger.info("discord.interaction.component.unresolve", extra={**logging_data})
            with record_event(MessagingInteractionType.UNRESOLVE).capture():
                return self.unresolve()

        elif self.custom_id.startswith(CustomIds.MARK_ONGOING):
            logger.info("discord.interaction.component.mark_ongoing", extra={**logging_data})
            with record_event(MessagingInteractionType.MARK_ONGOING).capture():
                return self.unresolve(from_mark_ongoing=True)

        elif self.custom_id.startswith(CustomIds.ARCHIVE):
            logger.info("discord.interaction.component.archive", extra={**logging_data})
            with record_event(MessagingInteractionType.ARCHIVE).capture():
                return self.archive()

        logger.warning("discord.interaction.component.unknown_custom_id", extra={**logging_data})
        return self.send_message(INVALID_GROUP_ID)

    def assign_dialog(self) -> Response:
        if (not self.group_id) or (not self.group):
            return self.send_message(INVALID_GROUP_ID)

        assign_selector = DiscordSelectMenu(
            custom_id=f"{CustomIds.ASSIGN}:{self.group_id}",
            placeholder="Select Assignee...",
            options=get_assign_selector_options(self.group),
        )
        message = DiscordMessageBuilder(
            components=[DiscordActionRow([assign_selector])],
            flags=DiscordMessageFlags().set_ephemeral(),
        )
        return self.send_message(message)

    def assign(self) -> Response:
        assignee = self.request.get_selected_options()[0]

        self.update_group(
            {
                "assignedTo": assignee,
                "integration": ActivityIntegration.DISCORD.value,
            }
        )

        logger.info(
            "discord.assign.dialog",
            extra={
                "assignee": assignee,
                "user": self.request.user,
            },
        )

        assert self.request.user is not None

        analytics.record(
            "integrations.discord.assign",
            actor_id=self.request.user.id,
        )

        message = DiscordMessageBuilder(
            content=ASSIGNEE_UPDATED,
            flags=DiscordMessageFlags().set_ephemeral(),
        )
        return self.send_message(message, update=True)

    def resolve_dialog(self) -> Response:
        resolve_selector = DiscordSelectMenu(
            custom_id=f"{CustomIds.RESOLVE}:{self.group_id}",
            placeholder="Select the resolution target",
            options=RESOLVE_DIALOG_OPTIONS,
        )
        message = DiscordMessageBuilder(
            components=[DiscordActionRow([resolve_selector])],
            flags=DiscordMessageFlags().set_ephemeral(),
        )
        return self.send_message(message)

    def resolve(self) -> Response:
        status: dict[str, object] = {
            "status": STATUS_TO_STRING_LOOKUP[GroupHistoryStatus.RESOLVED],
        }
        message = RESOLVED

        selected_option = ""
        if self.request.is_select_component():
            selected_option = self.request.get_selected_options()[0]

        if selected_option == "inNextRelease":
            status["statusDetails"] = {"inNextRelease": True}
            message = RESOLVED_IN_NEXT_RELEASE
        elif selected_option == "inCurrentRelease":
            status["statusDetails"] = {"inRelease": "latest"}
            message = RESOLVED_IN_CURRENT_RELEASE

        self.update_group(status)
        return self.send_message(message, update=self.request.is_select_component())

    def unresolve(self, from_mark_ongoing: bool = False) -> Response:
        self.update_group(
            {
                "status": STATUS_TO_STRING_LOOKUP[GroupHistoryStatus.UNRESOLVED],
                "substatus": SUBSTATUS_TO_STR[GroupSubStatus.ONGOING],
            }
        )

        if from_mark_ongoing:
            return self.send_message(MARKED_ONGOING)
        return self.send_message(UNRESOLVED)

    def archive(self) -> Response:
        self.update_group(
            {
                "status": STATUS_TO_STRING_LOOKUP[GroupHistoryStatus.IGNORED],
                "substatus": SUBSTATUS_TO_STR[GroupSubStatus.UNTIL_ESCALATING],
            }
        )
        return self.send_message(ARCHIVE_UNTIL_ESCALATES)

    def update_group(self, data: Mapping[str, object]) -> None:
        if self.group:
            analytics.record(
                "integrations.discord.status",
                organization_id=self.group.organization.id,
                user_id=self.user.id,
                status=data,
            )
            update_groups(
                request=self.request.request,
                group_ids=[self.group.id],
                projects=[self.group.project],
                organization_id=self.group.organization.id,
                user=self.user,
                data=data,
            )


def get_assign_selector_options(group: Group) -> list[DiscordSelectMenuOption]:
    """
    Helper function for building the new assignee dropdown.
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
