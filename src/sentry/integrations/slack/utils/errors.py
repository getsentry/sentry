import logging
from dataclasses import dataclass

from sentry_sdk import capture_message
from slack_sdk.errors import SlackApiError, SlackRequestError

_logger = logging.getLogger(__name__)


@dataclass(frozen=True, eq=True)
class SlackSdkErrorCategory:
    message: str


SLACK_SDK_ERROR_CATEGORIES = (
    ACCOUNT_INACTIVE := SlackSdkErrorCategory("account_inactive"),
    CHANNEL_NOT_FOUND := SlackSdkErrorCategory("channel_not_found"),
    CHANNEL_ARCHIVED := SlackSdkErrorCategory("is_archived"),
    MODAL_NOT_FOUND := SlackSdkErrorCategory("not_found"),
    RATE_LIMITED := SlackSdkErrorCategory("ratelimited"),
    RESTRICTED_ACTION := SlackSdkErrorCategory("restricted_action"),
    MESSAGE_LIMIT_EXCEEDED := SlackSdkErrorCategory("message_limit_exceeded"),
)

"""
Errors that are user configuration errors and should be recorded as a halt for SLOs.
"""
SLACK_SDK_HALT_ERROR_CATEGORIES = (
    ACCOUNT_INACTIVE,
    CHANNEL_NOT_FOUND,
    CHANNEL_ARCHIVED,
    RATE_LIMITED,
    RESTRICTED_ACTION,
    MESSAGE_LIMIT_EXCEEDED,
)

_CATEGORIES_BY_MESSAGE = {c.message: c for c in SLACK_SDK_ERROR_CATEGORIES}


def unpack_slack_api_error(exc: SlackApiError | SlackRequestError) -> SlackSdkErrorCategory | None:
    """Retrieve the Slack API error category from an exception object.

    Check two places in priority order:
    1. the error field of the server response;
    2. the first line of the message body
    """

    if isinstance(exc, SlackApiError):
        try:
            error_attr = exc.response["error"]
            return _CATEGORIES_BY_MESSAGE[error_attr]
        except KeyError:
            pass

    dump = str(exc)
    category = _CATEGORIES_BY_MESSAGE.get(dump.split("\n")[0])
    if category:
        return category

    # Indicate that a new value needs to be added to SLACK_SDK_ERROR_CATEGORIES
    _logger.warning("unrecognized_slack_api_message", extra={"slack_api_message": dump})
    capture_message("Unrecognized Slack API message. Api Message: %s" % dump, level="warning")
    return None
