from sentry.integrations.discord.message_builder.base.component.button import (
    DiscordButton,
    DiscordButtonStyle,
)


def test_some() -> None:
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


def test_all() -> None:
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
