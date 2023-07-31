from rest_framework.response import Response

from sentry.integrations.discord.message_builder.base.base import DiscordMessageBuilder
from sentry.integrations.discord.message_builder.base.component.action_row import DiscordActionRow
from sentry.integrations.discord.message_builder.base.component.select_menu import DiscordSelectMenu
from sentry.integrations.discord.message_builder.base.flags import DiscordMessageFlags
from sentry.integrations.discord.message_builder.issues import get_assign_selector_options
from sentry.integrations.discord.webhooks.handler import DiscordInteractionHandler
from sentry.models.group import Group


class DiscordMessageComponentHandler(DiscordInteractionHandler):
    """
    Handles logic for Discord Message Component interactions.

    Request passed in constructor must be a Message Component interaction.
    """

    def handle(self) -> Response:
        custom_id = self.request.get_component_custom_id()

        if custom_id.startswith("assign:"):
            # everything after the ':' is the group id
            group_id = custom_id.split(":")[1]
            group = Group.objects.get(id=group_id)

            assign_selector = DiscordSelectMenu(
                custom_id="assign_to",
                placeholder="Select Assignee...",
                options=get_assign_selector_options(group),
            )
            message = DiscordMessageBuilder(
                components=[DiscordActionRow([assign_selector])],
                flags=DiscordMessageFlags().set_ephemeral(),
            )
            return self.send_message(message)

        return self.help()
