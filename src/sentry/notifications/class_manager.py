from __future__ import annotations

from collections.abc import Callable, MutableMapping
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .notifications.base import BaseNotification


class NotificationClassAlreadySetException(Exception):
    pass


class NotificationClassNotSetException(Exception):
    pass


class NotificationClassManager:
    def __init__(self) -> None:
        self.classes: MutableMapping[str, type[BaseNotification]] = {}

    def register(self) -> Callable[[type[BaseNotification]], type[BaseNotification]]:
        def wrapped(notification_class: type[BaseNotification]) -> type[BaseNotification]:
            key = getattr(notification_class, "__name__")
            if key in self.classes:
                raise NotificationClassAlreadySetException()
            self.classes[key] = notification_class
            return notification_class

        return wrapped

    def get(self, class_name: str) -> type[BaseNotification]:
        if class_name not in self.classes:
            raise NotificationClassNotSetException()
        return self.classes[class_name]


# make instance and export it
manager = NotificationClassManager()
register = manager.register
get = manager.get
