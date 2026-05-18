from __future__ import annotations

import logging
from typing import Any, TypedDict

from sentry.models.group import Group
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.services.eventstore.models import Event, GroupEvent

logger = logging.getLogger("sentry.legacy_webhook")


class LegacyWebhookPayload(TypedDict):
    id: str
    project: str
    project_name: str
    project_slug: str
    logger: str | None
    level: str | None
    culprit: str | None
    message: str
    url: str
    triggering_rules: list[str]
    event: dict[str, Any]


def split_urls(value: str) -> list[str]:
    if not value:
        return []
    return list(filter(bool, (url.strip() for url in value.splitlines())))


def build_legacy_webhook_payload(
    group: Group, event: GroupEvent | Event, triggering_rules: list[str]
) -> LegacyWebhookPayload:
    event_data = dict(event.data or {})
    data: LegacyWebhookPayload = {
        "id": str(group.id),
        "project": group.project.slug,
        "project_name": group.project.name,
        "project_slug": group.project.slug,
        "logger": event.get_tag("logger"),
        "level": event.get_tag("level"),
        "culprit": group.culprit,
        "message": event.message,
        "url": group.get_absolute_url(params={"referrer": "webhooks_plugin"}),
        "triggering_rules": list(triggering_rules),
        "event": {
            **event_data,
            "tags": event.tags,
            "event_id": event.event_id,
            "id": event.event_id,
        },
    }
    return data


def send_legacy_webhooks_for_project(
    project: Project,
    group: Group,
    event: GroupEvent | Event,
    triggering_rules: list[str],
) -> None:
    from .tasks import send_legacy_webhook_task

    urls_raw = ProjectOption.objects.get_value(project, "webhooks:urls", default="")
    urls = split_urls(urls_raw)
    if not urls:
        return

    payload = build_legacy_webhook_payload(group, event, triggering_rules)
    for url in urls:
        send_legacy_webhook_task.delay(
            url=url, payload=payload, organization_id=project.organization_id
        )
