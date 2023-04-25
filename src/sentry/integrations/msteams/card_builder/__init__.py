from __future__ import annotations

from typing import Any, Dict, Mapping, Sequence, Union

from sentry.incidents.models import Incident, IncidentStatus
from sentry.integrations.metric_alerts import incident_attachment_info

ME = "ME"
MSTEAMS_URL_FORMAT = "[{text}]({url})"

# TODO: Covert these types to a class hierarchy.
# This is not ideal, but better than no typing. These types should be
# converted to a class hierarchy and messages should be built by composition.

TextBlock = Mapping[str, Union[str, bool]]
ImageBlock = Mapping[str, str]
ItemBlock = Union[str, TextBlock, ImageBlock]

ColumnBlock = Mapping[str, Union[str, Sequence[ItemBlock]]]
ColumnSetBlock = Mapping[str, Union[str, Sequence[ColumnBlock]]]
# NOTE: Instead of Any, it should have been block, but mypy does not support cyclic definition.
ContainerBlock = Mapping[str, Any]

Block = Union[TextBlock, ImageBlock, ColumnSetBlock, ContainerBlock]

InputChoiceSetBlock = Mapping[str, Union[str, Sequence[Mapping[str, Any]]]]

# Maps to Any because Actions can have an arbitrarily nested data field.
Action = Mapping[str, Any]
ActionSet = Mapping[str, Union[str, Sequence[Action]]]

AdaptiveCard = Mapping[str, Union[str, Sequence[Block], Sequence[Action]]]


def build_incident_attachment(
    incident: Incident,
    new_status: IncidentStatus,
    metric_value: int | None = None,
) -> Dict[str, Any]:
    data = incident_attachment_info(incident, new_status, metric_value)

    colors = {"Resolved": "good", "Warning": "warning", "Critical": "attention"}

    footer_text = "Sentry Incident | {}".format(data["ts"].strftime("%b %d"))

    return {
        "type": "AdaptiveCard",
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2",
        "body": [
            {
                "type": "ColumnSet",
                "columns": [
                    {
                        "type": "Column",
                        "style": colors[data["status"]],
                        "items": [],
                        "width": "20px",
                    },
                    {
                        "type": "Column",
                        "items": [
                            {
                                "type": "Container",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": "[{}]({})".format(
                                            data["title"], data["title_link"]
                                        ),
                                        "fontType": "Default",
                                        "weight": "Bolder",
                                    },
                                    {"type": "TextBlock", "text": data["text"], "isSubtle": True},
                                    {
                                        "type": "ColumnSet",
                                        "columns": [
                                            {
                                                "type": "Column",
                                                "items": [
                                                    {
                                                        "type": "Image",
                                                        "url": data["logo_url"],
                                                        "size": "Small",
                                                        "width": "20px",
                                                    }
                                                ],
                                                "width": "auto",
                                            },
                                            {
                                                "type": "Column",
                                                "items": [
                                                    {
                                                        "type": "TextBlock",
                                                        "spacing": "None",
                                                        "text": footer_text,
                                                        "isSubtle": True,
                                                        "wrap": True,
                                                        "height": "stretch",
                                                    }
                                                ],
                                                "width": "stretch",
                                            },
                                        ],
                                    },
                                ],
                            }
                        ],
                        "width": "stretch",
                    },
                ],
            }
        ],
    }
