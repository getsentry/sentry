from sentry.integrations.discord.message_builder.base.component.select_menu import (
    DiscordSelectMenu,
    DiscordSelectMenuOption,
)
from sentry.integrations.discord.requests.base import DiscordMessageComponentTypes
from sentry.testutils.cases import TestCase


class TestDiscordSelectMenu(TestCase):
    def test_empty(self):
        menu = DiscordSelectMenu("custom-id", [])
        result = menu.build()
        assert result == {
            "type": DiscordMessageComponentTypes.SELECT,
            "custom_id": "custom-id",
            "options": [],
            "min_values": 1,
            "max_values": 1,
            "disabled": False,
        }

    def test_disabled(self):
        menu = DiscordSelectMenu("custom-id", [], disabled=True)
        result = menu.build()
        assert result == {
            "type": DiscordMessageComponentTypes.SELECT,
            "custom_id": "custom-id",
            "options": [],
            "min_values": 1,
            "max_values": 1,
            "disabled": True,
        }

    def test_non_empty(self):
        option = DiscordSelectMenuOption("option", "first", "descriptionnn", True)
        other_option = DiscordSelectMenuOption("other", "second")
        menu = DiscordSelectMenu(
            "custom-id", [option, other_option], placeholder="place being held"
        )
        result = menu.build()
        assert result == {
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
