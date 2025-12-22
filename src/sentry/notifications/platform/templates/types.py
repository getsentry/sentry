from enum import StrEnum


class NotificationTemplateSource(StrEnum):
    TEST = "test"
    ERROR_ALERT = "error-alert-service"
    DEPLOYMENT = "deployment-service"
    SLOW_LOAD_METRIC_ALERT = "slow-load-metric-alert"
    PERFORMANCE_MONITORING = "performance-monitoring"
    TEAM_COMMUNICATION = "team-communication"
    DATA_EXPORT_SUCCESS = "data-export-success"
    DATA_EXPORT_FAILURE = "data-export-failure"
    CUSTOM_RULE_SAMPLES_FULFILLED = "custom-rule-samples-fulfilled"
    UNABLE_TO_DELETE_REPOSITORY = "unable-to-delete-repository"
    SEER_AUTOFIX_TRIGGER = "seer-autofix-trigger"
    SEER_AUTOFIX_ERROR = "seer-autofix-error"
    SEER_CONTEXT_INPUT = "seer-context-input"
    SEER_CONTEXT_INPUT_COMPLETE = "seer-context-input-complete"
