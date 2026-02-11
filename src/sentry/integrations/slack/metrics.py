# metrics constants

from slack_sdk.errors import SlackApiError

from sentry.integrations.slack.utils.errors import (
    SLACK_SDK_HALT_ERROR_CATEGORIES,
    unpack_slack_api_error,
)
from sentry.integrations.utils.metrics import EventLifecycle
from sentry.shared_integrations.exceptions import IntegrationConfigurationError, IntegrationError

# Utils
SLACK_UTILS_GET_USER_LIST_SUCCESS_DATADOG_METRIC = "sentry.integrations.slack.utils.users.success"
SLACK_UTILS_GET_USER_LIST_FAILURE_DATADOG_METRIC = "sentry.integrations.slack.utils.users.failure"
SLACK_UTILS_CHANNEL_SUCCESS_DATADOG_METRIC = "sentry.integrations.slack.utils.channel.success"
SLACK_UTILS_CHANNEL_FAILURE_DATADOG_METRIC = "sentry.integrations.slack.utils.channel.failure"


def record_lifecycle_termination_level(lifecycle: EventLifecycle, error: SlackApiError) -> None:
    try:
        translate_slack_api_error(error)
    except IntegrationConfigurationError as e:
        lifecycle.record_halt(e)
    except IntegrationError as e:
        lifecycle.record_failure(e)


def translate_slack_api_error(error: SlackApiError) -> None:
    reason = unpack_slack_api_error(error)
    if reason is not None:
        if reason in SLACK_SDK_HALT_ERROR_CATEGORIES:
            raise IntegrationConfigurationError(reason.message) from error
        else:
            raise IntegrationError(reason.message) from error
    else:
        raise IntegrationError(str(error)) from error
