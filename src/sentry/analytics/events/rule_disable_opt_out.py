import abc

from sentry import analytics


@analytics.eventclass()
class RuleDisableOptOut(analytics.Event, abc.ABC):
    rule_id: str
    user_id: str
    organization_id: str


@analytics.eventclass("rule_disable_opt_out.explicit")
class RuleDisableOptOutExplicit(RuleDisableOptOut):
    pass


@analytics.eventclass("rule_disable_opt_out.edit")
class RuleDisableOptOutEdit(RuleDisableOptOut):
    pass


analytics.register(RuleDisableOptOutExplicit)
analytics.register(RuleDisableOptOutEdit)
