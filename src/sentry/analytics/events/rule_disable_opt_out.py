import abc

from sentry import analytics


class RuleDisableOptOut(analytics.Event, abc.ABC):
    attributes = (
        analytics.Attribute("rule_id"),
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
    )


class RuleDisableOptOutExplicit(RuleDisableOptOut):
    type = "rule_disable_opt_out.explicit"


class RuleDisableOptOutEdit(RuleDisableOptOut):
    type = "rule_disable_opt_out.edit"


analytics.register(RuleDisableOptOutExplicit)
analytics.register(RuleDisableOptOutEdit)
