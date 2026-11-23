__all__ = ("Message",)

from typing import Any, Self

import orjson

from sentry.interfaces.base import Interface
from sentry.utils.json import prune_empty_keys


def stringify(value: Any) -> str | bytes | None:
    if isinstance(value, str):
        return value

    if isinstance(value, (int, float, bool)):
        return orjson.dumps(value)

    return None


class Message(Interface):
    """
    A message consisting of either a ``formatted`` arg, or an optional
    ``message`` with a list of ``params``.

    - ``message`` and ``formatted`` are limited to 1000 characters.

    >>> {
    >>>     "message": "My raw message with interpreted strings like %s",
    >>>     "formatted": "My raw message with interpreted strings like this",
    >>>     "params": ["this"]
    >>> }
    """

    score = 0
    display_score = 2050
    path = "logentry"
    external_type = "message"

    @classmethod
    def to_python(cls, data: dict[str, Any]) -> Self | None:
        for key in ("message", "formatted", "params"):
            data.setdefault(key, None)

        return super().to_python(data)

    def to_json(self) -> dict[str, Any]:
        return prune_empty_keys(
            {"message": self.message, "formatted": self.formatted, "params": self.params or None}
        )

    def to_string(self, event: Any) -> str:
        text = self.formatted or self.message
        return text
