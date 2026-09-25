from __future__ import annotations

import orjson
from slack_sdk.models.blocks import MarkdownTextObject, SectionBlock

from sentry.notifications.platform.shadow.compare import (
    MAX_VALUE_LENGTH,
    DiffEntry,
    DiffKind,
    DiffMarker,
    diff,
    normalize,
)
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.types import NotificationProviderKey


def test_diff_identical_payloads() -> None:
    payload = {"blocks": [{"type": "section", "text": {"text": "hi"}}], "text": "hi"}
    assert diff(payload, orjson.loads(orjson.dumps(payload))) == []


def test_diff_scalar_change() -> None:
    assert diff({"text": "a"}, {"text": "b"}) == [
        DiffEntry(path="$.text", kind=DiffKind.VALUE, legacy="a", platform="b")
    ]


def test_diff_type_change() -> None:
    assert diff({"flag": 1}, {"flag": True}) == [
        DiffEntry(path="$.flag", kind=DiffKind.VALUE, legacy=1, platform=True)
    ]
    assert diff({"a": [1]}, {"a": {"0": 1}}) == [
        DiffEntry(path="$.a", kind=DiffKind.VALUE, legacy=[1], platform={"0": 1})
    ]


def test_diff_missing_key_on_platform() -> None:
    assert diff({"text": "a", "color": "#fff"}, {"text": "a"}) == [
        DiffEntry(path="$.color", kind=DiffKind.MISSING, legacy="#fff", platform=DiffMarker.MISSING)
    ]


def test_diff_missing_key_on_legacy() -> None:
    assert diff({"text": "a"}, {"text": "a", "color": "#fff"}) == [
        DiffEntry(path="$.color", kind=DiffKind.MISSING, legacy=DiffMarker.MISSING, platform="#fff")
    ]


def test_diff_list_length_mismatch() -> None:
    assert diff({"blocks": [1, 2, 3]}, {"blocks": [1, 5]}) == [
        DiffEntry(path="$.blocks", kind=DiffKind.LENGTH, legacy=3, platform=2),
        DiffEntry(path="$.blocks[1]", kind=DiffKind.VALUE, legacy=2, platform=5),
        DiffEntry(path="$.blocks[2]", kind=DiffKind.MISSING, legacy=3, platform=DiffMarker.MISSING),
    ]
    assert diff([], [{"a": 1}]) == [
        DiffEntry(path="$", kind=DiffKind.LENGTH, legacy=0, platform=1),
        DiffEntry(path="$[0]", kind=DiffKind.MISSING, legacy=DiffMarker.MISSING, platform={"a": 1}),
    ]


def test_diff_nested_paths() -> None:
    legacy = {"blocks": [{}, {}, {"text": {"text": "old", "type": "mrkdwn"}}]}
    platform = {"blocks": [{}, {}, {"text": {"text": "new", "type": "mrkdwn"}}]}
    assert diff(legacy, platform) == [
        DiffEntry(path="$.blocks[2].text.text", kind=DiffKind.VALUE, legacy="old", platform="new")
    ]


def test_diff_quotes_non_identifier_keys() -> None:
    assert diff({"a-b": 1, "c d": 1}, {"a-b": 2, "c d": 2}) == [
        DiffEntry(path='$["a-b"]', kind=DiffKind.VALUE, legacy=1, platform=2),
        DiffEntry(path='$["c d"]', kind=DiffKind.VALUE, legacy=1, platform=2),
    ]


def test_diff_orders_keys_deterministically() -> None:
    legacy = {"z": 1, "a": 1, "m": 1}
    platform = {"m": 2, "z": 2, "a": 2}
    assert [entry.path for entry in diff(legacy, platform)] == ["$.a", "$.m", "$.z"]


def test_diff_truncates_long_values() -> None:
    long_text = "x" * (MAX_VALUE_LENGTH + 50)
    long_list = list(range(200))
    [text_entry] = diff({"text": long_text}, {"text": "short"})
    assert text_entry.legacy == "x" * MAX_VALUE_LENGTH + "…"
    assert text_entry.platform == "short"

    [missing_entry] = diff({"blocks": long_list}, {})
    assert isinstance(missing_entry.legacy, str)
    assert missing_entry.legacy.startswith("[0,1,2,")
    assert len(missing_entry.legacy) == MAX_VALUE_LENGTH + 1
    assert missing_entry.platform is DiffMarker.MISSING


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
    assert diff(legacy, platform) == []


def test_normalize_slack_metric_surfaces_attachment_differences() -> None:
    legacy = normalize(
        NotificationProviderKey.SLACK,
        (orjson.dumps([{"blocks": [], "color": "#FF0000"}]).decode(), "alert"),
    )
    platform = normalize(
        NotificationProviderKey.SLACK,
        SlackRenderable(blocks=[], attachments=[{"blocks": []}], text="alert"),
    )
    assert diff(legacy, platform) == [
        DiffEntry(
            path="$.attachments[0].color",
            kind=DiffKind.MISSING,
            legacy="#FF0000",
            platform=DiffMarker.MISSING,
        )
    ]


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
    assert diff(legacy, platform) == []


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
    assert diff(legacy, platform) == []
