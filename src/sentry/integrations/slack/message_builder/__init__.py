from typing import Any, Union

from sentry.issues.grouptype import GroupCategory

# TODO(mgaeta): Continue fleshing out these types.
SlackAttachment = dict[str, Any]
SlackBlock = dict[str, Any]
SlackBody = Union[SlackAttachment, SlackBlock, list[SlackAttachment]]

# Attachment colors used for issues with no actions take.
LEVEL_TO_COLOR = {
    "_actioned_issue": "#EDEEEF",
    "_incident_resolved": "#4DC771",
    "debug": "#FBE14F",
    "error": "#E03E2F",
    "fatal": "#FA4747",
    "info": "#2788CE",
    "warning": "#FFC227",
}

INCIDENT_COLOR_MAPPING = {
    "Resolved": "_incident_resolved",
    "Warning": "warning",
    "Critical": "fatal",
}

SLACK_URL_FORMAT = "<{url}|{text}>"

LEVEL_TO_EMOJI = {
    "_incident_resolved": ":green_circle:",
    "debug": ":bug:",
    "error": ":red_circle:",
    "fatal": ":red_circle:",
    "info": ":large_blue_circle:",
    "warning": ":large_yellow_circle:",
}

ACTION_EMOJI = ":white_circle:"

CATEGORY_TO_EMOJI = {
    GroupCategory.PERFORMANCE: ":large_blue_circle: :chart_with_upwards_trend:",
    GroupCategory.FEEDBACK: ":large_blue_circle: :busts_in_silhouette:",
    GroupCategory.CRON: ":large_yellow_circle: :spiral_calendar_pad:",
}

ACTIONED_CATEGORY_TO_EMOJI = {
    GroupCategory.PERFORMANCE: ACTION_EMOJI + " :chart_with_upwards_trend:",
    GroupCategory.FEEDBACK: ACTION_EMOJI + " :busts_in_silhouette:",
    GroupCategory.CRON: ACTION_EMOJI + " :spiral_calendar_pad:",
}
