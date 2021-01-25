from sentry.rules.conditions.event_attribute import EventAttributeCondition


class EventAttributeFilter(EventAttributeCondition):
    rule_type = "filter/event"
