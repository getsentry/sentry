from __future__ import annotations

from typing import TYPE_CHECKING, MutableMapping

if TYPE_CHECKING:
    from .notifications.base import BaseNotification


class NotificationClassAlreadySetException(Exception):
    pass


class NotificationClassManager:
    def __init__(self) -> None:
        self.classes: MutableMapping[str, BaseNotification] = {}

    def register(self):
        def wrapped(notification_class: BaseNotification) -> BaseNotification:
            key = notification_class.__name__
            if key in self.classes:
                raise NotificationClassAlreadySetException()
            self.classes[key] = notification_class
            return notification_class

        return wrapped

    def get(self, class_name):
        return self.classes[class_name]


# make instance and export it
manager = NotificationClassManager()
register = manager.register
get = manager.get
