import abc

from sentry import analytics


@analytics.eventclass()
class RuleReenable(analytics.Event, abc.ABC):
    """Re-enable a rule that was disabled"""

    rule_id: str
    user_id: str
    organization_id: str


@analytics.eventclass("rule_reenable.explicit")
class RuleReenableExplicit(RuleReenable):
    pass


@analytics.eventclass("rule_reenable.edit")
class RuleReenableEdit(RuleReenable):
    pass


analytics.register(RuleReenableExplicit)
analytics.register(RuleReenableEdit)
