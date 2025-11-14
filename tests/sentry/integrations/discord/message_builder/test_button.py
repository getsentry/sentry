from typing import int
from sentry.integrations.discord.message_builder.base.component.button import (
    DiscordButton,
    DiscordButtonStyle,
    DiscordLinkButton,
)


def test_custom_button() -> None:
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


def test_link_button() -> None:
    button = DiscordLinkButton(
        label="button label",
        url="https://sentry.io",
        disabled=False,
    )
    result = button.build()
    assert result == {
        "type": 2,
        "style": 5,
        "label": "button label",
        "url": "https://sentry.io",
        "disabled": False,
    }
