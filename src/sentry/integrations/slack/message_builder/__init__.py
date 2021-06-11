from typing import Any, Mapping, Sequence, Union

# TODO(mgaeta): Continue fleshing out these types.
SlackAttachment = Mapping[str, Any]
SlackBlock = Mapping[str, Any]
SlackBody = Union[SlackAttachment, Mapping[str, Sequence[SlackBlock]]]

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
