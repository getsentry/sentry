from collections import defaultdict
from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.permissions import SentryIsAuthenticated
from sentry.notifications.platform.discord.provider import DiscordRenderable, DiscordRenderer
from sentry.notifications.platform.email.provider import EmailRenderer
from sentry.notifications.platform.msteams.provider import MSTeamsRenderable, MSTeamsRenderer
from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.slack.provider import SlackRenderer
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationTemplate,
)


@control_silo_endpoint
class InternalRegisteredTemplatesEndpoint(Endpoint):
    owner = ApiOwner.ECOSYSTEM
    permission_classes = (SentryIsAuthenticated,)
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request: Request) -> Response:
        response: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for source, template_cls in template_registry.registrations.items():
            template = template_cls()
            if template.hide_from_debugger:
                continue
            response[template.category.value].append(
                serialize_template(template=template, source=source)
            )
        return Response(response)


def serialize_rendered_example(rendered_template: NotificationRenderedTemplate) -> dict[str, Any]:
    response: dict[str, Any] = {
        "subject": rendered_template.subject,
        "body": [
            {
                "type": block.type,
                "blocks": [
                    {"type": text_block.type, "text": text_block.text}
                    for text_block in block.blocks
                ],
            }
            for block in rendered_template.body
        ],
        "actions": [
            {"label": action.label, "link": action.link} for action in rendered_template.actions
        ],
    }
    if rendered_template.chart:
        response["chart"] = {
            "url": rendered_template.chart.url,
            "alt_text": rendered_template.chart.alt_text,
        }
    if rendered_template.footer:
        response["footer"] = rendered_template.footer
    return response


def serialize_email_preview[T: NotificationData](
    template: NotificationTemplate[T],
) -> dict[str, Any]:
    data = template.example_data
    rendered_template = template.render_example()
    email = EmailRenderer.render(data=data, rendered_template=rendered_template)
    return {
        "subject": email.subject,
        "text_content": email.body,
        "html_content": email.alternatives[0][0],
    }


def serialize_msteams_preview[T: NotificationData](
    template: NotificationTemplate[T],
) -> MSTeamsRenderable:
    data = template.example_data
    rendered_template = template.render_example()
    return MSTeamsRenderer.render(data=data, rendered_template=rendered_template)


def serialize_slack_preview[T: NotificationData](
    template: NotificationTemplate[T],
) -> dict[str, Any]:
    data = template.example_data
    rendered_template = template.render_example()
    message = SlackRenderer.render(data=data, rendered_template=rendered_template)

    serialized_blocks = []
    for block in message.get("blocks", []):
        serialized_blocks.append(block.to_dict())

    return {"blocks": serialized_blocks}


def serialize_discord_preview[T: NotificationData](
    template: NotificationTemplate[T],
) -> DiscordRenderable:
    data = template.example_data
    rendered_template = template.render_example()
    return DiscordRenderer.render(data=data, rendered_template=rendered_template)


def serialize_template[T: NotificationData](
    template: NotificationTemplate[T], source: str
) -> dict[str, Any]:
    response: dict[str, Any] = {
        "source": source,
        "category": template.category,
        "example": serialize_rendered_example(rendered_template=template.render_example()),
        "previews": {
            NotificationProviderKey.EMAIL: serialize_email_preview(template=template),
            NotificationProviderKey.MSTEAMS: serialize_msteams_preview(template=template),
            NotificationProviderKey.SLACK: serialize_slack_preview(template=template),
            NotificationProviderKey.DISCORD: serialize_discord_preview(template=template),
        },
    }
    return response
