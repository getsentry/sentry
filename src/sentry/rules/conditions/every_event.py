from sentry.rules.conditions.base import EventCondition


class EveryEventCondition(EventCondition):
    id = "sentry.rules.conditions.every_event.EveryEventCondition"
    label = "The event occurs"

    def is_enabled(self) -> bool:
        return False
