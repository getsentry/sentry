from __future__ import annotations

from datetime import datetime
from typing import Literal

from sentry.incidents.models.incident import IncidentStatus
from sentry.integrations.metric_alerts import AlertContext, incident_attachment_info
from sentry.integrations.msteams.card_builder.block import (
    AdaptiveCard,
    ColumnWidth,
    ImageSize,
    TextWeight,
)
from sentry.models.organization import Organization
from sentry.snuba.models import SnubaQuery


def build_incident_attachment(
    alert_context: AlertContext,
    open_period_identifier: int,
    snuba_query: SnubaQuery,
    organization: Organization,
    date_started: datetime,
    new_status: IncidentStatus,
    metric_value: float | None = None,
    notification_uuid: str | None = None,
) -> AdaptiveCard:

    data = incident_attachment_info(
        alert_context=alert_context,
        open_period_identifier=open_period_identifier,
        organization=organization,
        snuba_query=snuba_query,
        metric_value=metric_value,
        new_status=new_status,
        notification_uuid=notification_uuid,
        referrer="metric_alert_msteams",
    )

    colors: dict[str, Literal["good", "warning", "attention"]]
    colors = {"Resolved": "good", "Warning": "warning", "Critical": "attention"}

    footer_text = "Sentry Incident | {}".format(date_started.strftime("%b %d"))

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
