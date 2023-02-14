from sentry.eventstore.models import Event


class EventStripper:
    def __init__(self):
        self

    ALLOWED_EVENT_KEYS = {
        "type",
        "datetime",
        "timestamp",
        "platform",
        "sdk",
        "level",
        "logger",
        "exception",
        "debug_meta",
        "contexts",
    }

    def strip_event_data(self, event: Event) -> Event:

        new_event = dict(filter(self._filter_event, event.items()))

        new_event["contexts"] = dict(filter(self._filter_contexts, new_event["contexts"].items()))

        return new_event

    def _filter_event(self, pair):
        key, _ = pair
        if key in self.ALLOWED_EVENT_KEYS:
            return True

        return False

    def _filter_contexts(self, pair):
        key, _ = pair
        if key in {"os", "device"}:
            return True
        return False
