from typing import int
import pytest

from sentry.integrations.discord.message_builder.base.component.action_row import (
    DiscordActionRow,
    DiscordActionRowError,
)
from sentry.integrations.discord.message_builder.base.component.base import DiscordMessageComponent
from sentry.integrations.discord.message_builder.base.component.button import (
    DiscordButton,
    DiscordButtonStyle,
    DiscordLinkButton,
)
from sentry.testutils.cases import TestCase


class TestDiscordActionRow(TestCase):
    def test_empty(self) -> None:
        action_row = DiscordActionRow([])
        result = action_row.build()
        assert result == {
            "type": 1,
            "components": [],
        }

    def test_non_empty(self) -> None:
        custom_button = DiscordButton(
            style=DiscordButtonStyle.PRIMARY,
            custom_id="test_button",
            label="a custom button",
            disabled=True,
        )
        link_button = DiscordLinkButton(
            label="a link",
            url="https://sentry.io",
        )
        custom_component = DiscordMessageComponent(
            type=9
        )  # not a real type number, just testing custom component
        action_row = DiscordActionRow(
            [
                link_button,
                custom_button,
                custom_component,
            ]
        )
        result = action_row.build()
        assert result == {
            "type": 1,
            "components": [
                {
                    "type": 2,
                    "style": 5,
                    "label": "a link",
                    "url": "https://sentry.io",
                    "disabled": False,
                },
                {
                    "type": 2,
                    "style": 1,
                    "custom_id": "test_button",
                    "label": "a custom button",
                    "disabled": True,
                },
                {
                    "type": 9,
                },
            ],
        }

    def test_action_row_error(self) -> None:
        nested_row = DiscordActionRow([])
        with pytest.raises(DiscordActionRowError):
            DiscordActionRow([nested_row])
