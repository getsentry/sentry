from sentry.rules.conditions.tagged_event import TaggedEventCondition


class TaggedEventFilter(TaggedEventCondition):
    id = "sentry.rules.filters.tagged_event.TaggedEventFilter"
    rule_type = "filter/event"
