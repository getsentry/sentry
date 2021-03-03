from sentry.rules.conditions.tagged_event import TaggedEventCondition


class TaggedEventFilter(TaggedEventCondition):
    rule_type = "filter/event"
