from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import Any

import orjson

from sentry.notifications.platform.shadow.capture import ShadowPayload
from sentry.notifications.platform.types import NotificationProviderKey

DISCORD_VOLATILE_EMBED_KEYS = frozenset({"timestamp"})


def _to_jsonable(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {k: _to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_to_jsonable(v) for v in value]
    to_dict = getattr(value, "to_dict", None)
    if callable(to_dict):
        return _to_jsonable(to_dict())
    return value


def _as_list(value: Any) -> Any:
    if not value:
        return []
    if isinstance(value, (str, bytes)):
        value = orjson.loads(value)
    return _to_jsonable(value)


def _normalize_slack(payload: ShadowPayload) -> dict[str, Any]:
    if isinstance(payload, tuple):
        attachments, text = payload
        payload = {"attachments": attachments, "text": text}
    # Only these keys reach chat.postMessage on either send path.
    return {
        "blocks": _as_list(payload.get("blocks")),
        "attachments": _as_list(payload.get("attachments")),
        "text": payload.get("text") or "",
    }


def _without_integration_id(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {k: _without_integration_id(v) for k, v in value.items() if k != "integrationId"}
    if isinstance(value, (list, tuple)):
        return [_without_integration_id(v) for v in value]
    return value


def _normalize_msteams(payload: ShadowPayload) -> Any:
    return _without_integration_id(_to_jsonable(payload))


def _normalize_discord(payload: ShadowPayload) -> Any:
    message = _to_jsonable(payload)
    if isinstance(message, dict) and isinstance(message.get("embeds"), list):
        message["embeds"] = [
            (
                {k: v for k, v in embed.items() if k not in DISCORD_VOLATILE_EMBED_KEYS}
                if isinstance(embed, dict)
                else embed
            )
            for embed in message["embeds"]
        ]
    return message


_NORMALIZERS: dict[NotificationProviderKey, Callable[[ShadowPayload], Any]] = {
    NotificationProviderKey.SLACK: _normalize_slack,
    NotificationProviderKey.SLACK_STAGING: _normalize_slack,
    NotificationProviderKey.MSTEAMS: _normalize_msteams,
    NotificationProviderKey.DISCORD: _normalize_discord,
}


def normalize(provider: NotificationProviderKey, payload: ShadowPayload) -> Any:
    normalizer = _NORMALIZERS.get(provider)
    if normalizer is None:
        return _to_jsonable(payload)
    return normalizer(payload)
