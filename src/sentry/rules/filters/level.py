from sentry.rules.conditions.level import LevelCondition


class LevelFilter(LevelCondition):
    id = "sentry.rules.filters.level.LevelFilter"
    rule_type = "filter/event"
