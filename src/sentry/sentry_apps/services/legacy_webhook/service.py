from __future__ import annotations

import logging
from typing import Any, TypedDict

from sentry.models.options.project_option import ProjectOption
from sentry.workflow_engine.models import Workflow
from sentry.workflow_engine.types import ActionInvocation

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


def _get_triggering_rule_name(invocation: ActionInvocation) -> str:
    try:
        workflow = Workflow.objects.get(id=invocation.workflow_id)
        return workflow.name
    except Workflow.DoesNotExist:
        return invocation.detector.name


def build_legacy_webhook_payload(invocation: ActionInvocation) -> LegacyWebhookPayload:
    group = invocation.event_data.group
    event = invocation.event_data.event
    triggering_rules = [_get_triggering_rule_name(invocation)]
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
        "triggering_rules": triggering_rules,
        "event": {
            **event_data,
            "tags": event.tags,
            "event_id": event.event_id,
            "id": event.event_id,
        },
    }
    return data


def send_legacy_webhooks_for_invocation(invocation: ActionInvocation) -> None:
    # Delayed import to avoid circular dependency (tasks imports LegacyWebhookPayload from here)
    from sentry.sentry_apps.services.legacy_webhook.tasks import send_legacy_webhook_task

    project = invocation.detector.project
    urls_raw = ProjectOption.objects.get_value(project, "webhooks:urls", default="")
    urls = split_urls(urls_raw)
    if not urls:
        return

    payload = build_legacy_webhook_payload(invocation)
    for url in urls:
        send_legacy_webhook_task.delay(url=url, payload=payload)
