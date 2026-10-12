from sentry.incidents.models.alert_rule import AlertRuleTriggerAction

__all__ = ("ACTION_TARGET_TYPE_TO_STRING",)

ACTION_TARGET_TYPE_TO_STRING = {
    AlertRuleTriggerAction.TargetType.USER: "user",
    AlertRuleTriggerAction.TargetType.TEAM: "team",
    AlertRuleTriggerAction.TargetType.SPECIFIC: "specific",
    AlertRuleTriggerAction.TargetType.SENTRY_APP: "sentry_app",
    AlertRuleTriggerAction.TargetType.ISSUE_OWNERS: "issue_owners",
}
