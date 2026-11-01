from __future__ import annotations

from sentry.shared_integrations.exceptions import ApiError


def dict_items(value: object, *, context: str) -> list[dict[str, object]]:
    if not isinstance(value, list):
        raise ApiError(f"Expected a {context} list")
    items: list[dict[str, object]] = []
    for item in value:
        if not isinstance(item, dict):
            raise ApiError(f"Expected a {context} object")
        items.append(item)
    return items
