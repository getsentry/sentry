from sentry.rules.conditions.base import EventCondition


class FirstSeenEventCondition(EventCondition):
    id = "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"
    label = "A new issue is created"
