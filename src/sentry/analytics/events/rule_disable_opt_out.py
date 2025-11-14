from typing import int
import abc

from sentry import analytics


@analytics.eventclass()
class RuleDisableOptOut(analytics.Event, abc.ABC):
    rule_id: int
    user_id: int
    organization_id: int


@analytics.eventclass("rule_disable_opt_out.explicit")
class RuleDisableOptOutExplicit(RuleDisableOptOut):
    pass


@analytics.eventclass("rule_disable_opt_out.edit")
class RuleDisableOptOutEdit(RuleDisableOptOut):
    pass


analytics.register(RuleDisableOptOutExplicit)
analytics.register(RuleDisableOptOutEdit)
