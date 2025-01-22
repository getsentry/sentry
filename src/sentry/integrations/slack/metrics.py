# metrics constants

from slack_sdk.errors import SlackApiError

from sentry.integrations.slack.utils.errors import (
    SLACK_SDK_HALT_ERROR_CATEGORIES,
    unpack_slack_api_error,
)
from sentry.integrations.utils.metrics import EventLifecycle

SLACK_ISSUE_ALERT_SUCCESS_DATADOG_METRIC = "sentry.integrations.slack.issue_alert.success"
SLACK_ISSUE_ALERT_FAILURE_DATADOG_METRIC = "sentry.integrations.slack.issue_alert.failure"

# Webhooks
SLACK_WEBHOOK_EVENT_ENDPOINT_SUCCESS_DATADOG_METRIC = (
    "sentry.integrations.slack.event_endpoint.success"
)
SLACK_WEBHOOK_EVENT_ENDPOINT_FAILURE_DATADOG_METRIC = (
    "sentry.integrations.slack.event_endpoint.failure"
)
SLACK_WEBHOOK_GROUP_ACTIONS_SUCCESS_DATADOG_METRIC = (
    "sentry.integrations.slack.group_actions.success"
)
SLACK_WEBHOOK_GROUP_ACTIONS_FAILURE_DATADOG_METRIC = (
    "sentry.integrations.slack.group_actions.failure"
)

# Sending messages upon linking/unlinking
SLACK_LINK_IDENTITY_MSG_SUCCESS_DATADOG_METRIC = (
    "sentry.integrations.slack.link_identity_msg.success"
)
SLACK_LINK_IDENTITY_MSG_FAILURE_DATADOG_METRIC = (
    "sentry.integrations.slack.link_identity_msg.failure"
)
SLACK_LINK_TEAM_MSG_SUCCESS_DATADOG_METRIC = "sentry.integrations.slack.link_team_msg.success"
SLACK_LINK_TEAM_MSG_FAILURE_DATADOG_METRIC = "sentry.integrations.slack.link_team_msg.failure"


SLACK_NOTIFY_MIXIN_SUCCESS_DATADOG_METRIC = "sentry.integrations.slack.notify_mixin.success"
SLACK_NOTIFY_MIXIN_FAILURE_DATADOG_METRIC = "sentry.integrations.slack.notify_mixin.failure"

# Utils
SLACK_UTILS_GET_USER_LIST_SUCCESS_DATADOG_METRIC = "sentry.integrations.slack.utils.users.success"
SLACK_UTILS_GET_USER_LIST_FAILURE_DATADOG_METRIC = "sentry.integrations.slack.utils.users.failure"
SLACK_UTILS_CHANNEL_SUCCESS_DATADOG_METRIC = "sentry.integrations.slack.utils.channel.success"
SLACK_UTILS_CHANNEL_FAILURE_DATADOG_METRIC = "sentry.integrations.slack.utils.channel.failure"


# Middleware Parsers
SLACK_MIDDLE_PARSERS_SUCCESS_DATADOG_METRIC = "sentry.middleware.integrations.slack.parsers.success"
SLACK_MIDDLE_PARSERS_FAILURE_DATADOG_METRIC = "sentry.middleware.integrations.slack.parsers.failure"


def record_lifecycle_termination_level(lifecycle: EventLifecycle, error: SlackApiError) -> None:
    if (
        (reason := unpack_slack_api_error(error))
        and reason is not None
        and reason in SLACK_SDK_HALT_ERROR_CATEGORIES
    ):
        lifecycle.record_halt(reason.message)
    else:
        lifecycle.record_failure(error)
