from enum import StrEnum
from typing import Any, Union

from sentry.issues.grouptype import GroupCategory

# TODO(mgaeta): Continue fleshing out these types.
SlackAttachment = dict[str, Any]
SlackBlock = dict[str, Any]
SlackBody = Union[SlackAttachment, SlackBlock]


class SlackAction(StrEnum):
    """
    These are encoded into the action_id of a Slack block (see `encode_action_id` in `routing.py`).
    Keep in mind that Slack requires each action in a message to have a unique action_id.
    """

    STATUS = "status"
    UNRESOLVED_ONGOING = "unresolved:ongoing"
    RESOLVE_DIALOG = "resolve_dialog"
    ARCHIVE_DIALOG = "archive_dialog"
    ASSIGN = "assign"
    SEER_AUTOFIX_START = "seer_autofix_start"
    SEER_CONTEXT_INPUT = "seer_context_input"


INCIDENT_COLOR_MAPPING = {
    "Resolved": "_incident_resolved",
    "Warning": "warning",
    "Critical": "fatal",
}

SLACK_URL_FORMAT = "<{url}|{text}>"

LEVEL_TO_EMOJI = {
    "_incident_resolved": [":green_circle:"],
    "debug": [":bug:"],
    "error": [":red_circle:"],
    "fatal": [":red_circle:"],
    "info": [":large_blue_circle:"],
    "warning": [":large_yellow_circle:"],
}

ACTION_EMOJI = [":white_circle:"]

CATEGORY_TO_EMOJI = {
    GroupCategory.PERFORMANCE: [":large_blue_circle:", ":chart_with_upwards_trend:"],
    GroupCategory.FEEDBACK: [":large_blue_circle:", ":busts_in_silhouette:"],
    GroupCategory.CRON: [":large_yellow_circle:", ":spiral_calendar_pad:"],
}

ACTIONED_CATEGORY_TO_EMOJI: dict[GroupCategory, list[str]] = {
    GroupCategory.PERFORMANCE: [ACTION_EMOJI[0], ":chart_with_upwards_trend:"],
    GroupCategory.FEEDBACK: [ACTION_EMOJI[0], ":busts_in_silhouette:"],
    GroupCategory.CRON: [ACTION_EMOJI[0], ":spiral_calendar_pad:"],
}
