from __future__ import annotations

from typing import Literal

from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.integrations.metric_alerts import (
    AlertContext,
    get_metric_count_from_incident,
    incident_attachment_info,
)
from sentry.integrations.msteams.card_builder.block import (
    AdaptiveCard,
    ColumnWidth,
    ImageSize,
    TextWeight,
)


def build_incident_attachment(
    incident: Incident,
    new_status: IncidentStatus,
    metric_value: float | None = None,
    notification_uuid: str | None = None,
) -> AdaptiveCard:
    if metric_value is None:
        metric_value = get_metric_count_from_incident(incident)

    data = incident_attachment_info(
        AlertContext.from_alert_rule_incident(incident.alert_rule),
        open_period_identifier=incident.identifier,
        organization=incident.organization,
        snuba_query=incident.alert_rule.snuba_query,
        metric_value=metric_value,
        new_status=new_status,
        notification_uuid=notification_uuid,
        referrer="metric_alert_msteams",
    )

    colors: dict[str, Literal["good", "warning", "attention"]]
    colors = {"Resolved": "good", "Warning": "warning", "Critical": "attention"}

    footer_text = "Sentry Incident | {}".format(incident.date_started.strftime("%b %d"))

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
                                        "weight": TextWeight.BOLDER,
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
                                                        "size": ImageSize.SMALL,
                                                        "width": "20px",
                                                    }
                                                ],
                                                "width": ColumnWidth.AUTO,
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
                                                "width": ColumnWidth.STRETCH,
                                            },
                                        ],
                                    },
                                ],
                            }
                        ],
                        "width": ColumnWidth.STRETCH,
                    },
                ],
            }
        ],
    }
