from collections import defaultdict
from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.permissions import SentryIsAuthenticated
from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    NotificationData,
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
            response[template.category.value].append(
                serialize_template(template=template, source=source)
            )
        return Response(response)


def serialize_rendered_example(rendered_template: NotificationRenderedTemplate) -> dict[str, Any]:
    response: dict[str, Any] = {
        "subject": rendered_template.subject,
        "body": rendered_template.body,
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


def serialize_template[T: NotificationData](
    template: NotificationTemplate[T], source: str
) -> dict[str, Any]:
    response: dict[str, Any] = {
        "source": source,
        "category": template.category,
        "example": serialize_rendered_example(rendered_template=template.render_example()),
    }
    return response
