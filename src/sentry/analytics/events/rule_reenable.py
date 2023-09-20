from sentry import analytics


class RuleReenable(analytics.Event):
    """Re-enable a rule that was disabled"""

    type = "rule.reenable"
    attributes = (
        analytics.Attribute("rule_id"),
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
    )


analytics.register(RuleReenable)
