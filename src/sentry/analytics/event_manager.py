from __future__ import absolute_import

__all__ = ("default_manager", "EventManager")


class EventManager(object):
    def __init__(self):
        self._event_types = {}

    def register(self, event_cls):
        """
        >>> register(OrganizationCreatedEvent)
        """
        event_type = event_cls.type
        if event_type in self._event_types:
            assert self._event_types[event_type] == event_cls
        else:
            self._event_types[event_type] = event_cls

    def get(self, type):
        return self._event_types[type]


default_manager = EventManager()
