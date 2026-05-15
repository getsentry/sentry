from __future__ import annotations

import logging
from collections.abc import Sequence

from sentry.models.group import Group
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.services.eventstore.models import GroupEvent

logger = logging.getLogger("sentry.legacy_webhook")


def split_urls(value: str) -> list[str]:
    if not value:
        return []
    return list(filter(bool, (url.strip() for url in value.splitlines())))


def build_legacy_webhook_payload(
    group: Group, event: GroupEvent, triggering_rules: Sequence[str]
) -> dict:
    data = {
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
    }
    data["event"] = dict(event.data or {})
    data["event"]["tags"] = event.tags
    data["event"]["event_id"] = event.event_id
    data["event"]["id"] = event.event_id
    return data


def send_legacy_webhooks_for_project(
    project: Project,
    group: Group,
    event: GroupEvent,
    triggering_rules: Sequence[str],
) -> None:
    from .tasks import send_legacy_webhook_task

    urls_raw = ProjectOption.objects.get_value(project, "webhooks:urls", default="")
    urls = split_urls(urls_raw)
    if not urls:
        return

    payload = build_legacy_webhook_payload(group, event, triggering_rules)
    for url in urls:
        send_legacy_webhook_task.delay(url=url, payload=payload)


def log_legacy_webhook_dry_run(
    project: Project,
    group: Group,
    event: GroupEvent,
    triggering_rules: Sequence[str],
) -> None:
    urls_raw = ProjectOption.objects.get_value(project, "webhooks:urls", default="")
    urls = split_urls(urls_raw)
    if not urls:
        return

    payload = build_legacy_webhook_payload(group, event, triggering_rules)
    logger.info(
        "legacy_webhook.dry_run",
        extra={
            "project_id": project.id,
            "group_id": group.id,
            "urls": urls,
            "payload_keys": list(payload.keys()),
        },
    )
