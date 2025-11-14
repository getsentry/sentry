from typing import int
from sentry import analytics


@analytics.eventclass()
class RuleSnoozeAction(analytics.Event):
    user_id: int | None
    organization_id: int
    project_id: int
    rule_type: str
    target: str
    # maps to AlertRule or Rule
    rule_id: int


@analytics.eventclass("rule.snoozed")
class RuleSnoozed(RuleSnoozeAction):
    until: str | None = None


@analytics.eventclass("rule.unsnoozed")
class RuleUnSnoozed(RuleSnoozeAction):
    pass


analytics.register(RuleSnoozed)
analytics.register(RuleUnSnoozed)
