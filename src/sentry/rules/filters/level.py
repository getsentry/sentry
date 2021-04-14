from sentry.rules.conditions.level import LevelCondition


class LevelFilter(LevelCondition):
    rule_type = "filter/event"
