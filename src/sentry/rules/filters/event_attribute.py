from sentry.rules.conditions.event_attribute import EventAttributeCondition


class EventAttributeFilter(EventAttributeCondition):
    id = "sentry.rules.filters.event_attribute.EventAttributeFilter"
    rule_type = "filter/event"
