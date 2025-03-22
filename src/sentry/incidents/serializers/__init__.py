from sentry.notifications.models.notificationaction import ActionTarget

__all__ = (
    "AlertRuleSerializer",
    "AlertRuleTriggerSerializer",
    "AlertRuleTriggerActionSerializer",
    "ACTION_TARGET_TYPE_TO_STRING",
    "STRING_TO_ACTION_TARGET_TYPE",
)

ACTION_TARGET_TYPE_TO_STRING = {
    ActionTarget.USER: "user",
    ActionTarget.TEAM: "team",
    ActionTarget.SPECIFIC: "specific",
    ActionTarget.SENTRY_APP: "sentry_app",
}
STRING_TO_ACTION_TARGET_TYPE = {v: k for (k, v) in ACTION_TARGET_TYPE_TO_STRING.items()}


from .alert_rule import AlertRuleSerializer
from .alert_rule_trigger import AlertRuleTriggerSerializer
from .alert_rule_trigger_action import AlertRuleTriggerActionSerializer
