from sentry.rules.conditions.base import EventCondition


class ReappearedEventCondition(EventCondition):
    id = "sentry.rules.conditions.reappeared_event.ReappearedEventCondition"
    label = "An issue escalates"
