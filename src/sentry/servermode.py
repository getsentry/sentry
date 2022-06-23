from __future__ import annotations

from enum import Enum


class ServerComponentMode(Enum):
    """Defines the component mode of the application to be acting as."""

    MONOLITH = "MONOLITH"
    CONTROL = "CONTROL"
    CUSTOMER = "CUSTOMER"
    FRONTEND = "FRONTEND"

    @classmethod
    def resolve(cls, name: str) -> ServerComponentMode:
        try:
            obj = getattr(cls, name)
            if isinstance(obj, cls):
                return obj
        except AttributeError:
            pass
        raise ValueError(f"Not a {cls.__name__} name: {name!r}")

    def is_active(self) -> bool:
        from django.conf import settings

        return settings.SERVER_COMPONENT_MODE in (self, self.MONOLITH)
