from sentry.integrations.discord.message_builder.base.component.button import (
    DiscordButton,
    DiscordButtonStyle,
)
from sentry.testutils.cases import TestCase


class TestDiscordButton(TestCase):
    def test_some(self):
        button = DiscordButton(
            style=DiscordButtonStyle.PRIMARY,
            custom_id="test_button",
            label="button label",
        )
        result = button.build()
        assert result == {
            "type": 2,
            "style": 1,
            "custom_id": "test_button",
            "label": "button label",
            "disabled": False,
        }

    def test_all(self):
        button = DiscordButton(
            style=DiscordButtonStyle.PRIMARY,
            custom_id="test_button",
            label="button label",
            url="https://sentry.io",
            disabled=True,
        )
        result = button.build()
        assert result == {
            "type": 2,
            "style": 1,
            "custom_id": "test_button",
            "label": "button label",
            "url": "https://sentry.io",
            "disabled": True,
        }
