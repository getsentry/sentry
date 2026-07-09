from enum import StrEnum


class SentryAppEventType(StrEnum):
    """Events/features that Sentry Apps can do"""

    # event webhooks
    ERROR_CREATED = "error.created"
    ISSUE_CREATED = "issue.created"

    # issue alert webhooks
    EVENT_ALERT_TRIGGERED = "event_alert.triggered"
    ACTIVITY_ALERT_TRIGGERED = "activity_alert.triggered"

    # external request webhooks
    EXTERNAL_ISSUE_CREATED = "external_issue.created"
    EXTERNAL_ISSUE_LINKED = "external_issue.linked"
    SELECT_OPTIONS_REQUESTED = "select_options.requested"
    ALERT_RULE_ACTION_REQUESTED = "alert_rule_action.requested"

    # metric alert webhooks
    METRIC_ALERT_OPEN = "metric_alert.open"
    METRIC_ALERT_RESOLVED = "metric_alert.resolved"
    METRIC_ALERT_CRITICAL = "metric_alert.critical"
    METRIC_ALERT_WARNING = "metric_alert.warning"

    # comment webhooks
    COMMENT_CREATED = "comment.created"
    COMMENT_UPDATED = "comment.updated"
    COMMENT_DELETED = "comment.deleted"

    # installation webhooks
    INSTALLATION_CREATED = "installation.created"
    INSTALLATION_DELETED = "installation.deleted"

    # workflow notification
    ISSUE_IGNORED = "issue.ignored"
    ISSUE_ARCHIVED = "issue.archived"
    ISSUE_UNRESOLVED = "issue.unresolved"
    ISSUE_RESOLVED = "issue.resolved"
    ISSUE_ASSIGNED = "issue.assigned"

    # authorizations
    GRANT_EXCHANGER = "grant_exchanger"
    REFRESHER = "refresher"
    MANUAL_REFRESHER = "manual_refresher"

    # management
    APP_CREATE = "app_create"
    APP_UPDATE = "app_update"
    REQUESTS = "requests"
    WEBHOOK_UPDATE = "webhook_update"
    INSTALLATION_CREATE = "install_create"
    INSTALLATION_WEBHOOK_UPDATE = "installation_webhook_update"

    # seer webhooks
    SEER_ROOT_CAUSE_STARTED = "seer.root_cause_started"
    SEER_ROOT_CAUSE_COMPLETED = "seer.root_cause_completed"
    SEER_SOLUTION_STARTED = "seer.solution_started"
    SEER_SOLUTION_COMPLETED = "seer.solution_completed"
    SEER_CODING_STARTED = "seer.coding_started"
    SEER_CODING_COMPLETED = "seer.coding_completed"
    SEER_PR_CREATED = "seer.pr_created"
    SEER_ITERATION_STARTED = "seer.iteration_started"
    SEER_ITERATION_COMPLETED = "seer.iteration_completed"

    # preprod artifact webhooks
    PREPROD_ARTIFACT_SIZE_ANALYSIS_COMPLETED = "preprod_artifact.size_analysis_completed"
    PREPROD_ARTIFACT_BUILD_DISTRIBUTION_COMPLETED = "preprod_artifact.build_distribution_completed"
