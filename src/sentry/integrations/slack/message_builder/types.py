from typing import Any, Union

from sentry.issues.grouptype import GroupCategory

# TODO(mgaeta): Continue fleshing out these types.
SlackAttachment = dict[str, Any]
SlackBlock = dict[str, Any]
SlackBody = Union[SlackAttachment, SlackBlock]

INCIDENT_COLOR_MAPPING = {
    "Resolved": "_incident_resolved",
    "Warning": "warning",
    "Critical": "fatal",
}

SLACK_URL_FORMAT = "<{url}|{text}>"

LEVEL_TO_EMOJI = {
    "_incident_resolved": ["green_circle"],
    "debug": ["bug"],
    "error": ["red_circle"],
    "fatal": ["red_circle"],
    "info": ["large_blue_circle"],
    "warning": ["large_yellow_circle"],
}

ACTION_EMOJI = ["white_circle"]

CATEGORY_TO_EMOJI = {
    GroupCategory.PERFORMANCE: ["large_blue_circle", "chart_with_upwards_trend"],
    GroupCategory.FEEDBACK: ["large_blue_circle", "busts_in_silhouette"],
    GroupCategory.CRON: ["large_yellow_circle", "spiral_calendar_pad"],
}

ACTIONED_CATEGORY_TO_EMOJI: dict[GroupCategory, list[str]] = {
    GroupCategory.PERFORMANCE: [ACTION_EMOJI[0], "chart_with_upwards_trend"],
    GroupCategory.FEEDBACK: [ACTION_EMOJI[0], "busts_in_silhouette"],
    GroupCategory.CRON: [ACTION_EMOJI[0], "spiral_calendar_pad"],
}
