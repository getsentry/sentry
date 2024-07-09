import logging
from dataclasses import dataclass

from slack_sdk.errors import SlackApiError, SlackRequestError

_logger = logging.getLogger(__name__)


@dataclass(frozen=True, eq=True)
class SlackSdkErrorCategory:
    message: str


SLACK_SDK_ERROR_CATEGORIES = (
    RATE_LIMITED := SlackSdkErrorCategory("ratelimited"),
    CHANNEL_NOT_FOUND := SlackSdkErrorCategory("channel_not_found"),
    EXPIRED_URL := SlackSdkErrorCategory("Expired url"),
)

_CATEGORIES_BY_MESSAGE = {c.message: c for c in SLACK_SDK_ERROR_CATEGORIES}


def unpack_slack_api_error(exc: SlackApiError | SlackRequestError) -> SlackSdkErrorCategory | None:
    message = (isinstance(exc, SlackApiError) and exc.response["error"]) or str(exc).split("\n")[0]
    category = _CATEGORIES_BY_MESSAGE.get(message)
    if category is None:
        # Indicate that a new value needs to be added to SLACK_SDK_ERROR_CATEGORIES
        _logger.warning("unrecognized_slack_api_message", extra={"slack_api_message": message})
    return category
