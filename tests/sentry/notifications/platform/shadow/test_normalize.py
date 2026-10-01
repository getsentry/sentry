from __future__ import annotations

import orjson
from slack_sdk.models.blocks import MarkdownTextObject, SectionBlock

from sentry.notifications.platform.shadow.normalize import normalize
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.types import NotificationProviderKey


def test_normalize_slack_metric_json_string_attachments() -> None:
    attachment_blocks = [
        {"type": "section", "text": {"type": "mrkdwn", "text": "124 events\nStarted"}},
        {"type": "image", "image_url": "https://chart.example/1.png", "alt_text": "Chart"},
    ]
    legacy_attachments = orjson.dumps([{"blocks": attachment_blocks, "color": "#FF0000"}]).decode()
    legacy = normalize(
        NotificationProviderKey.SLACK,
        (legacy_attachments, "<https://sentry.io|*Critical: Alert*>"),
    )
    platform = normalize(
        NotificationProviderKey.SLACK,
        SlackRenderable(
            blocks=[],
            attachments=[{"blocks": attachment_blocks, "color": "#FF0000"}],
            text="<https://sentry.io|*Critical: Alert*>",
        ),
    )

    assert legacy == {
        "blocks": [],
        "attachments": [{"blocks": attachment_blocks, "color": "#FF0000"}],
        "text": "<https://sentry.io|*Critical: Alert*>",
    }
    assert legacy == platform


def test_normalize_slack_metric_surfaces_attachment_differences() -> None:
    legacy = normalize(
        NotificationProviderKey.SLACK,
        (orjson.dumps([{"blocks": [], "color": "#FF0000"}]).decode(), "alert"),
    )
    platform = normalize(
        NotificationProviderKey.SLACK,
        SlackRenderable(blocks=[], attachments=[{"blocks": []}], text="alert"),
    )
    assert legacy["attachments"] == [{"blocks": [], "color": "#FF0000"}]
    assert platform["attachments"] == [{"blocks": []}]


def test_normalize_slack_issue_blocks() -> None:
    blocks = [{"type": "section", "text": {"type": "mrkdwn", "text": "hello"}}]
    legacy = normalize(
        NotificationProviderKey.SLACK,
        {"blocks": blocks, "text": "hello", "color": "#E03E2F"},
    )
    platform = normalize(
        NotificationProviderKey.SLACK_STAGING,
        SlackRenderable(
            blocks=[SectionBlock(text=MarkdownTextObject(text="hello"))],
            text="hello",
        ),
    )

    assert legacy == {"blocks": blocks, "attachments": [], "text": "hello"}
    assert legacy == platform


def test_normalize_slack_defaults_missing_keys() -> None:
    assert normalize(NotificationProviderKey.SLACK, {}) == {
        "blocks": [],
        "attachments": [],
        "text": "",
    }


def test_normalize_msteams_strips_integration_id() -> None:
    card = {
        "type": "AdaptiveCard",
        "body": [{"type": "TextBlock", "text": "Issue"}],
        "actions": [
            {
                "type": "Action.Submit",
                "data": {"actionType": "resolve", "integrationId": 1, "groupId": 2},
            },
            {
                "type": "Action.ShowCard",
                "card": {
                    "actions": [
                        {"type": "Action.Submit", "data": {"integrationId": 1, "groupId": 2}}
                    ]
                },
            },
        ],
    }
    normalized = normalize(NotificationProviderKey.MSTEAMS, card)

    assert "integrationId" not in orjson.dumps(normalized).decode()
    assert normalized["actions"][0]["data"] == {"actionType": "resolve", "groupId": 2}
    assert normalized["actions"][1]["card"]["actions"][0]["data"] == {"groupId": 2}
    assert normalized["body"] == card["body"]


def test_normalize_discord_strips_embed_timestamps() -> None:
    def message(timestamp: str) -> dict[str, object]:
        return {
            "content": "",
            "embeds": [{"title": "Error", "color": 1, "timestamp": timestamp}],
            "components": [],
        }

    legacy = normalize(
        NotificationProviderKey.DISCORD,
        message("2026-09-24T10:00:00+00:00"),
    )
    platform = normalize(
        NotificationProviderKey.DISCORD,
        message("2026-09-24T10:00:05+00:00"),
    )

    assert legacy == {
        "content": "",
        "embeds": [{"title": "Error", "color": 1}],
        "components": [],
    }
    assert legacy == platform
