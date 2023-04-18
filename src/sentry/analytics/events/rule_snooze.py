from sentry import analytics


class RuleSnoozeAction(analytics.Event):
    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("rule_type"),
        analytics.Attribute("target"),
        # maps to AlertRule or Rule
        analytics.Attribute("rule_id"),
    )


class RuleSnoozed(RuleSnoozeAction):
    type = "rule.snoozed"
    attributes = RuleSnoozeAction.attributes + (analytics.Attribute("until", required=False),)  # type: ignore


class RuleUnSnoozed(RuleSnoozeAction):
    type = "rule.unsnoozed"


analytics.register(RuleSnoozed)
analytics.register(RuleUnSnoozed)
