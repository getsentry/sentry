from __future__ import annotations

import logging
from typing import Any, TypedDict

from sentry.eventstore.models import GroupEvent
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.rule import Rule
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.tasks.sentry_apps import send_alert_webhook_v2
from sentry.workflow_engine.models import AlertRuleWorkflow, Workflow
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


def get_triggering_rule_name(invocation: ActionInvocation) -> str:
    try:
        workflow = Workflow.objects.get(id=invocation.workflow_id)
        label = workflow.name
    except Workflow.DoesNotExist:
        return invocation.detector.name

    alert_rule_workflow = AlertRuleWorkflow.objects.filter(
        workflow_id=workflow.id,
        rule_id__isnull=False,
    ).first()
    if alert_rule_workflow:
        try:
            label = Rule.objects.get(
                id=alert_rule_workflow.rule_id,
                project__organization_id=workflow.organization_id,
            ).label
        except Rule.DoesNotExist:
            logger.exception(
                "Rule not found when querying for AlertRuleWorkflow",
                extra={"rule_id": alert_rule_workflow.rule_id},
            )

    return label


def build_legacy_webhook_payload(invocation: ActionInvocation) -> LegacyWebhookPayload:
    group = invocation.event_data.group
    event = invocation.event_data.event
    if not isinstance(event, GroupEvent):
        raise TypeError(f"Legacy webhook payload requires a GroupEvent, got {type(event).__name__}")
    triggering_rules = [get_triggering_rule_name(invocation)]
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


def send_sentry_app_webhook(
    *,
    group_event: GroupEvent,
    sentry_app_slug: str | None,
    rule_label: str,
    organization: Organization,
) -> None:
    logging_context = {
        "organization_id": organization.id,
        "sentry_app_slug": sentry_app_slug,
    }

    if not sentry_app_slug:
        logger.warning("webhook_action_handler.missing_target_identifier", extra=logging_context)
        return

    sentry_app = app_service.get_sentry_app_by_slug(slug=sentry_app_slug)
    if sentry_app is None:
        logger.warning(
            "webhook_action_handler.sentry_app_not_found",
            extra=logging_context,
        )
        return

    send_alert_webhook_v2.delay(
        rule_label=rule_label,
        sentry_app_id=sentry_app.id,
        instance_id=group_event.event_id,
        group_id=group_event.group_id,
        occurrence_id=getattr(group_event, "occurrence_id", None),
    )


def send_legacy_webhooks_for_invocation(invocation: ActionInvocation) -> None:
    # Delayed import to avoid circular dependency (tasks imports LegacyWebhookPayload from here)
    from sentry.sentry_apps.services.legacy_webhook.tasks import send_legacy_webhook_task

    project = invocation.detector.project
    enabled = ProjectOption.objects.get_value(project, "webhooks:enabled", default=False)
    if not enabled:
        return

    urls_raw = ProjectOption.objects.get_value(project, "webhooks:urls", default="")
    urls = split_urls(urls_raw)
    if not urls:
        return

    payload = build_legacy_webhook_payload(invocation)
    for url in urls:
        send_legacy_webhook_task.delay(url=url, payload=payload)
