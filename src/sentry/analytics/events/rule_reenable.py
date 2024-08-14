import abc

from sentry import analytics


class RuleReenable(analytics.Event, abc.ABC):
    """Re-enable a rule that was disabled"""

    attributes = (
        analytics.Attribute("rule_id"),
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
    )


class RuleReenableExplicit(RuleReenable):
    type = "rule_reenable.explicit"


class RuleReenableEdit(RuleReenable):
    type = "rule_reenable.edit"


analytics.register(RuleReenableExplicit)
analytics.register(RuleReenableEdit)
