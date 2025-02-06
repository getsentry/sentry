from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType

__all__ = (
    "AlertRuleSerializer",
    "AlertRuleTriggerSerializer",
    "AlertRuleTriggerActionSerializer",
    "ACTION_TARGET_TYPE_TO_STRING",
    "STRING_TO_ACTION_TARGET_TYPE",
)

ACTION_TARGET_TYPE_TO_STRING = {
    AlertRuleTriggerAction.TargetType.USER: "user",
    AlertRuleTriggerAction.TargetType.TEAM: "team",
    AlertRuleTriggerAction.TargetType.SPECIFIC: "specific",
    AlertRuleTriggerAction.TargetType.SENTRY_APP: "sentry_app",
}
STRING_TO_ACTION_TARGET_TYPE = {v: k for (k, v) in ACTION_TARGET_TYPE_TO_STRING.items()}
QUERY_TYPE_VALID_EVENT_TYPES = {
    SnubaQuery.Type.ERROR: {
        SnubaQueryEventType.EventType.ERROR,
        SnubaQueryEventType.EventType.DEFAULT,
    },
    SnubaQuery.Type.PERFORMANCE: {SnubaQueryEventType.EventType.TRANSACTION},
}
QUERY_TYPE_VALID_DATASETS = {
    SnubaQuery.Type.ERROR: {Dataset.Events},
    SnubaQuery.Type.PERFORMANCE: {
        Dataset.Transactions,
        Dataset.PerformanceMetrics,
        Dataset.EventsAnalyticsPlatform,
    },
    SnubaQuery.Type.CRASH_RATE: {Dataset.Metrics},
}


from .alert_rule import AlertRuleSerializer
from .alert_rule_trigger import AlertRuleTriggerSerializer
from .alert_rule_trigger_action import AlertRuleTriggerActionSerializer
