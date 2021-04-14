__all__ = ("Message",)


from sentry.interfaces.base import Interface
from sentry.utils import json
from sentry.utils.json import prune_empty_keys


def stringify(value):
    if isinstance(value, str):
        return value

    if isinstance(value, (int, float, bool)):
        return json.dumps(value)

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
    def to_python(cls, data):
        for key in ("message", "formatted", "params"):
            data.setdefault(key, None)
        return cls(**data)

    def to_json(self):
        return prune_empty_keys(
            {"message": self.message, "formatted": self.formatted, "params": self.params or None}
        )

    def to_string(self, event, is_public=False, **kwargs):
        return self.formatted or self.message
