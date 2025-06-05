from sentry import analytics


@analytics.eventclass()
class RuleSnoozeAction(analytics.Event):
    user_id: str
    organization_id: str
    project_id: str
    rule_type: str
    target: str
    # maps to AlertRule or Rule
    rule_id: str


@analytics.eventclass("rule.snoozed")
class RuleSnoozed(RuleSnoozeAction):

    until: str | None = None


@analytics.eventclass("rule.unsnoozed")
class RuleUnSnoozed(RuleSnoozeAction):
    pass


analytics.register(RuleSnoozed)
analytics.register(RuleUnSnoozed)
