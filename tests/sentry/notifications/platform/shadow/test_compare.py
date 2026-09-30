from __future__ import annotations

from dataclasses import asdict

import orjson
from slack_sdk.models.blocks import MarkdownTextObject, SectionBlock

from sentry.notifications.platform.shadow.compare import (
    DiffEntry,
    DiffKind,
    ValueShape,
    diff,
    normalize,
)
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.types import NotificationProviderKey

INT = ValueShape(type="int")


def _str(length: int) -> ValueShape:
    return ValueShape(type="str", length=length)


def test_diff_identical_payloads() -> None:
    payload = {"blocks": [{"type": "section", "text": {"text": "hi"}}], "text": "hi"}
    assert diff(payload, orjson.loads(orjson.dumps(payload))) == []


def test_diff_scalar_change() -> None:
    assert diff({"text": "a"}, {"text": "bc"}) == [
        DiffEntry(path="$.text", kind=DiffKind.VALUE, legacy=_str(1), platform=_str(2))
    ]


def test_diff_type_change() -> None:
    assert diff({"flag": 1}, {"flag": True}) == [
        DiffEntry(path="$.flag", kind=DiffKind.VALUE, legacy=INT, platform=ValueShape(type="bool"))
    ]
    assert diff({"a": [1]}, {"a": {"0": 1}}) == [
        DiffEntry(
            path="$.a",
            kind=DiffKind.VALUE,
            legacy=ValueShape(type="list", length=1),
            platform=ValueShape(type="dict", length=1),
        )
    ]
    assert diff({"a": None}, {"a": ""}) == [
        DiffEntry(
            path="$.a", kind=DiffKind.VALUE, legacy=ValueShape(type="NoneType"), platform=_str(0)
        )
    ]


def test_diff_missing_key_on_platform() -> None:
    assert diff({"text": "a", "color": "#fff"}, {"text": "a"}) == [
        DiffEntry(path="$.color", kind=DiffKind.MISSING, legacy=_str(4), platform=None)
    ]


def test_diff_missing_key_on_legacy() -> None:
    assert diff({"text": "a"}, {"text": "a", "color": "#fff"}) == [
        DiffEntry(path="$.color", kind=DiffKind.MISSING, legacy=None, platform=_str(4))
    ]


def test_diff_list_length_mismatch() -> None:
    assert diff({"blocks": [1, 2, 3]}, {"blocks": [1, 5]}) == [
        DiffEntry(
            path="$.blocks",
            kind=DiffKind.LENGTH,
            legacy=ValueShape(type="list", length=3),
            platform=ValueShape(type="list", length=2),
        ),
        DiffEntry(path="$.blocks[1]", kind=DiffKind.VALUE, legacy=INT, platform=INT),
        DiffEntry(path="$.blocks[2]", kind=DiffKind.MISSING, legacy=INT, platform=None),
    ]
    assert diff([], [{"a": 1}]) == [
        DiffEntry(
            path="$",
            kind=DiffKind.LENGTH,
            legacy=ValueShape(type="list", length=0),
            platform=ValueShape(type="list", length=1),
        ),
        DiffEntry(
            path="$[0]",
            kind=DiffKind.MISSING,
            legacy=None,
            platform=ValueShape(type="dict", length=1),
        ),
    ]


def test_diff_nested_paths() -> None:
    legacy = {"blocks": [{}, {}, {"text": {"text": "old", "type": "mrkdwn"}}]}
    platform = {"blocks": [{}, {}, {"text": {"text": "newer", "type": "mrkdwn"}}]}
    assert diff(legacy, platform) == [
        DiffEntry(
            path="$.blocks[2].text.text", kind=DiffKind.VALUE, legacy=_str(3), platform=_str(5)
        )
    ]


def test_diff_quotes_non_identifier_keys() -> None:
    assert diff({"a-b": 1, "c d": 1}, {"a-b": 2, "c d": 2}) == [
        DiffEntry(path='$["a-b"]', kind=DiffKind.VALUE, legacy=INT, platform=INT),
        DiffEntry(path='$["c d"]', kind=DiffKind.VALUE, legacy=INT, platform=INT),
    ]


def test_diff_orders_keys_deterministically() -> None:
    legacy = {"z": 1, "a": 1, "m": 1}
    platform = {"m": 2, "z": 2, "a": 2}
    assert [entry.path for entry in diff(legacy, platform)] == ["$.a", "$.m", "$.z"]


def test_diff_entries_exclude_values() -> None:
    legacy = {"text": "user@example.com", "tags": [{"value": "10.0.0.1"}], "level": "fatal"}
    platform = {"text": "other@example.com", "level": "warning"}
    entries = diff(legacy, platform)

    assert [entry.path for entry in entries] == ["$.level", "$.tags", "$.text"]
    serialized = orjson.dumps([asdict(entry) for entry in entries]).decode()
    for value in ("example.com", "10.0.0.1", "fatal", "warning"):
        assert value not in serialized


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
            legacy=_str(7),
            platform=None,
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
