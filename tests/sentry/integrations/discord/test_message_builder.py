import pytest

from sentry.integrations.discord.message_builder import LEVEL_TO_COLOR
from sentry.integrations.discord.message_builder.base.base import DiscordMessageBuilder
from sentry.integrations.discord.message_builder.base.component.action_row import (
    DiscordActionRow,
    DiscordActionRowError,
)
from sentry.integrations.discord.message_builder.base.component.base import DiscordMessageComponent
from sentry.integrations.discord.message_builder.base.component.button import (
    DiscordButton,
    DiscordButtonStyle,
)
from sentry.integrations.discord.message_builder.base.embed.base import DiscordMessageEmbed
from sentry.integrations.discord.message_builder.base.embed.field import DiscordMessageEmbedField
from sentry.integrations.discord.message_builder.base.embed.footer import DiscordMessageEmbedFooter
from sentry.testutils.cases import TestCase


class TestBaseDiscordMessageBuilder(TestCase):
    def test_empty(self):
        message = DiscordMessageBuilder()
        result = message.build()
        assert result == {}


class TestDiscordButton(TestCase):
    def test_some_fields(self):
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

    def test_all_fields(self):
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


class TestDiscordActionRow(TestCase):
    def test_empty(self):
        action_row = DiscordActionRow([])
        result = action_row.build()
        assert result == {
            "type": 1,
            "components": [],
        }

    def test_non_empty(self):
        button = DiscordButton(
            style=DiscordButtonStyle.PRIMARY,
            custom_id="test_button",
            label="button label",
            url="https://sentry.io",
            disabled=True,
        )
        custom_component = DiscordMessageComponent(
            type=9
        )  # not a real type number, just testing custom component
        action_row = DiscordActionRow(
            [
                button,
                custom_component,
            ]
        )
        result = action_row.build()
        assert result == {
            "type": 1,
            "components": [
                {
                    "type": 2,
                    "style": 1,
                    "custom_id": "test_button",
                    "label": "button label",
                    "url": "https://sentry.io",
                    "disabled": True,
                },
                {
                    "type": 9,
                },
            ],
        }

    def test_action_row_error(self):
        nested_row = DiscordActionRow([])
        with pytest.raises(DiscordActionRowError):
            DiscordActionRow([nested_row])


class TestDiscordMessageEmbed(TestCase):
    def test_empty(self):
        embed = DiscordMessageEmbed()
        result = embed.build()
        assert result == {}

    def test_some_fields(self):
        embed = DiscordMessageEmbed(
            title="Title",
            url="https://sentry.io",
            color=LEVEL_TO_COLOR["warning"],
        )
        result = embed.build()
        assert result == {
            "title": "Title",
            "url": "https://sentry.io",
            "color": 16761383,
        }

    def test_footer(self):
        footer = DiscordMessageEmbedFooter(text="footer text", icon_url="https://sentry.io")
        embed = DiscordMessageEmbed(footer=footer)
        result = embed.build()
        assert result == {
            "footer": {
                "text": "footer text",
                "icon_url": "https://sentry.io",
            }
        }

    def test_fields(self):
        field = DiscordMessageEmbedField(
            "field name",
            "field value",
            True,
        )
        other_field = DiscordMessageEmbedField(
            "other field name",
            "other field value",
        )
        embed = DiscordMessageEmbed(fields=[field, other_field])
        result = embed.build()
        assert result == {
            "fields": [
                {
                    "name": "field name",
                    "value": "field value",
                    "inline": True,
                },
                {
                    "name": "other field name",
                    "value": "other field value",
                    "inline": False,
                },
            ]
        }

    def test_all(self):
        footer = DiscordMessageEmbedFooter(text="footer text", icon_url="https://sentry.io")
        field = DiscordMessageEmbedField(
            "field name",
            "field value",
            True,
        )
        embed = DiscordMessageEmbed(
            title="Title",
            description="description",
            url="https://sentry.io",
            color=LEVEL_TO_COLOR["warning"],
            footer=footer,
            fields=[field],
        )
        result = embed.build()
        assert result == {
            "title": "Title",
            "description": "description",
            "url": "https://sentry.io",
            "color": 16761383,
            "footer": {
                "text": "footer text",
                "icon_url": "https://sentry.io",
            },
            "fields": [
                {
                    "name": "field name",
                    "value": "field value",
                    "inline": True,
                }
            ],
        }
