from __future__ import annotations

from typing import TYPE_CHECKING, Callable, MutableMapping, Type

if TYPE_CHECKING:
    from .notifications.base import BaseNotification


class NotificationClassAlreadySetException(Exception):
    pass


class NotificationClassNotSetException(Exception):
    pass


class NotificationClassManager:
    def __init__(self) -> None:
        self.classes: MutableMapping[str, Type[BaseNotification]] = {}

    def register(self) -> Callable[[Type[BaseNotification]], Type[BaseNotification]]:
        def wrapped(notification_class: Type[BaseNotification]) -> Type[BaseNotification]:
            key = getattr(notification_class, "__name__")
            if key in self.classes:
                raise NotificationClassAlreadySetException()
            self.classes[key] = notification_class
            return notification_class

        return wrapped

    def get(self, class_name: str) -> Type[BaseNotification]:
        if class_name not in self.classes:
            raise NotificationClassNotSetException()
        return self.classes[class_name]


# make instance and export it
manager = NotificationClassManager()
register = manager.register
get = manager.get
