from sentry.integrations.discord.message_builder import LEVEL_TO_COLOR
from sentry.integrations.discord.message_builder.base.base import DiscordMessageBuilder
from sentry.integrations.discord.message_builder.base.component.action_row import DiscordActionRow
from sentry.integrations.discord.message_builder.base.component.button import (
    DiscordButton,
    DiscordButtonStyle,
)
from sentry.integrations.discord.message_builder.base.component.select_menu import (
    DiscordSelectMenu,
    DiscordSelectMenuOption,
)
from sentry.integrations.discord.message_builder.base.embed.base import DiscordMessageEmbed
from sentry.integrations.discord.message_builder.base.flags import (
    EPHEMERAL_FLAG,
    DiscordMessageFlags,
)
from sentry.integrations.discord.requests.base import DiscordMessageComponentTypes
from sentry.testutils.cases import TestCase


class TestDiscordMessageBuilder(TestCase):
    def test_empty(self):
        message = DiscordMessageBuilder()
        result = message.build()
        assert result == {
            "content": "",
            "components": [],
            "embeds": [],
        }

    def test_some(self):
        flags = DiscordMessageFlags().set_ephemeral()
        message = DiscordMessageBuilder(
            content="message content",
            flags=flags,
        )
        result = message.build()
        assert result == {
            "content": "message content",
            "components": [],
            "embeds": [],
            "flags": EPHEMERAL_FLAG,
        }

    def test_all(self):
        embed = DiscordMessageEmbed(
            title="Title",
            description="description",
            url="https://sentry.io",
            color=LEVEL_TO_COLOR["warning"],
        )
        other_embed = DiscordMessageEmbed(
            title="Other title",
            description="other description",
            color=LEVEL_TO_COLOR["info"],
        )
        button = DiscordButton(
            style=DiscordButtonStyle.PRIMARY,
            custom_id="test_button",
            label="button label",
        )
        other_button = DiscordButton(
            style=DiscordButtonStyle.DANGER,
            custom_id="danger_button",
            label="delete",
        )
        component = DiscordActionRow([button, other_button])
        option = DiscordSelectMenuOption("option", "first", "descriptionnn", True)
        other_option = DiscordSelectMenuOption("other", "second")
        menu = DiscordSelectMenu(
            "custom-id", [option, other_option], placeholder="place being held"
        )
        other_component = DiscordActionRow([menu])

        flags = DiscordMessageFlags().set_ephemeral()

        message = DiscordMessageBuilder(
            content="message content",
            embeds=[embed, other_embed],
            components=[component, other_component],
            flags=flags,
        )
        result = message.build()
        assert result == {
            "content": "message content",
            "embeds": [
                {
                    "title": "Title",
                    "description": "description",
                    "url": "https://sentry.io",
                    "color": LEVEL_TO_COLOR["warning"],
                },
                {
                    "title": "Other title",
                    "description": "other description",
                    "color": LEVEL_TO_COLOR["info"],
                },
            ],
            "components": [
                {
                    "type": DiscordMessageComponentTypes.ACTION_ROW,
                    "components": [
                        {
                            "type": DiscordMessageComponentTypes.BUTTON,
                            "style": DiscordButtonStyle.PRIMARY,
                            "custom_id": "test_button",
                            "label": "button label",
                            "disabled": False,
                        },
                        {
                            "type": DiscordMessageComponentTypes.BUTTON,
                            "style": DiscordButtonStyle.DANGER,
                            "custom_id": "danger_button",
                            "label": "delete",
                            "disabled": False,
                        },
                    ],
                },
                {
                    "type": DiscordMessageComponentTypes.ACTION_ROW,
                    "components": [
                        {
                            "type": DiscordMessageComponentTypes.SELECT,
                            "custom_id": "custom-id",
                            "options": [
                                {
                                    "label": "option",
                                    "value": "first",
                                    "description": "descriptionnn",
                                    "default": True,
                                },
                                {
                                    "label": "other",
                                    "value": "second",
                                    "default": False,
                                },
                            ],
                            "placeholder": "place being held",
                            "min_values": 1,
                            "max_values": 1,
                            "disabled": False,
                        }
                    ],
                },
            ],
            "flags": EPHEMERAL_FLAG,
        }
