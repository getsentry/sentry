__all__ = ("default_manager", "EventManager")


from sentry.analytics.event import Event
from sentry.utils.registry import Registry


class EventManager(Registry[type[Event]]):
    def register(self, event_cls: type[Event]) -> None:
        return super().register(event_cls.type)(event_cls)


default_manager = EventManager()
