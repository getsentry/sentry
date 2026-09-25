from __future__ import annotations

from typing import Literal

from sentry.incidents.models.incident import IncidentStatus
from sentry.notifications.platform.msteams.provider import MSTeamsRenderable
from sentry.notifications.platform.registry import renderer_registry
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.templates.metric_alert import MetricAlertNotificationData
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationSource,
)


@renderer_registry.register(
    NotificationProviderKey.MSTEAMS, sources=[NotificationSource.METRIC_ALERT]
)
class MSTeamsMetricAlertRenderer(NotificationRenderer[MSTeamsRenderable]):
    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> MSTeamsRenderable:
        if not isinstance(data, MetricAlertNotificationData):
            raise ValueError(
                f"MSTeamsMetricAlertRenderer does not support {data.__class__.__name__}"
            )

        from sentry.integrations.metric_alerts import get_status_text, logo_url
        from sentry.integrations.msteams.card_builder.block import (
            ColumnWidth,
            ImageSize,
            TextWeight,
        )

        colors: dict[str, Literal["good", "warning", "attention"]]
        colors = {"Resolved": "good", "Warning": "warning", "Critical": "attention"}

        status = get_status_text(IncidentStatus(data.new_status))
        footer_text = "Sentry Incident | {}".format(
            data.open_period_context.date_started.strftime("%b %d")
        )

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
                            "style": colors[status],
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
                                            "text": f"[{data.title}]({data.title_link})",
                                            "fontType": "Default",
                                            "weight": TextWeight.BOLDER,
                                        },
                                        {"type": "TextBlock", "text": data.text, "isSubtle": True},
                                        {
                                            "type": "ColumnSet",
                                            "columns": [
                                                {
                                                    "type": "Column",
                                                    "items": [
                                                        {
                                                            "type": "Image",
                                                            "url": logo_url(),
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
