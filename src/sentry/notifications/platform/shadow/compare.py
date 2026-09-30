from __future__ import annotations

import re
from collections.abc import Callable, Iterator, Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

import orjson

from sentry.notifications.platform.shadow.capture import ShadowPayload
from sentry.notifications.platform.types import NotificationProviderKey

DISCORD_VOLATILE_EMBED_KEYS = frozenset({"timestamp"})


class DiffKind(StrEnum):
    VALUE = "value"
    MISSING = "missing"
    LENGTH = "length"


@dataclass(frozen=True)
class ValueShape:
    """
    The type and size of a payload value. Payloads carry customer data, so diff entries describe
    values without containing them.
    """

    type: str
    length: int | None = None


@dataclass(frozen=True)
class DiffEntry:
    """
    A difference at `path`. The side a `MISSING` entry is absent from has no shape.
    """

    path: str
    kind: DiffKind
    legacy: ValueShape | None
    platform: ValueShape | None


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


_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _shape(value: Any) -> ValueShape:
    if isinstance(value, (str, bytes, Mapping, list, tuple)):
        return ValueShape(type=type(value).__name__, length=len(value))
    return ValueShape(type=type(value).__name__)


def _walk(legacy: Any, platform: Any, path: str) -> Iterator[DiffEntry]:
    if isinstance(legacy, Mapping) and isinstance(platform, Mapping):
        for key in sorted(legacy.keys() | platform.keys(), key=str):
            name = str(key)
            if _IDENTIFIER.match(name):
                child = f"{path}.{name}"
            else:
                child = f"{path}[{orjson.dumps(name).decode()}]"
            if key not in platform:
                yield DiffEntry(child, DiffKind.MISSING, _shape(legacy[key]), None)
            elif key not in legacy:
                yield DiffEntry(child, DiffKind.MISSING, None, _shape(platform[key]))
            else:
                yield from _walk(legacy[key], platform[key], child)
    elif isinstance(legacy, (list, tuple)) and isinstance(platform, (list, tuple)):
        if len(legacy) != len(platform):
            yield DiffEntry(path, DiffKind.LENGTH, _shape(legacy), _shape(platform))
        for index in range(max(len(legacy), len(platform))):
            child = f"{path}[{index}]"
            if index >= len(platform):
                yield DiffEntry(child, DiffKind.MISSING, _shape(legacy[index]), None)
            elif index >= len(legacy):
                yield DiffEntry(child, DiffKind.MISSING, None, _shape(platform[index]))
            else:
                yield from _walk(legacy[index], platform[index], child)
    elif legacy != platform or isinstance(legacy, bool) != isinstance(platform, bool):
        yield DiffEntry(path, DiffKind.VALUE, _shape(legacy), _shape(platform))


def diff(legacy: Any, platform: Any) -> list[DiffEntry]:
    return list(_walk(legacy, platform, "$"))
