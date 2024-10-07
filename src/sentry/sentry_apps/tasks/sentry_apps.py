from collections.abc import Mapping
from typing import Any

from celery import Task

from sentry.eventstore.models import Event
from sentry.tasks.base import instrumented_task
from sentry.tasks.sentry_apps import CONTROL_TASK_OPTIONS, TASK_OPTIONS
from sentry.tasks.sentry_apps import build_comment_webhook as old_build_comment_webhook
from sentry.tasks.sentry_apps import clear_region_cache as old_clear_region_cache
from sentry.tasks.sentry_apps import (
    create_or_update_service_hooks_for_sentry_app as old_create_or_update_service_hooks_for_sentry_app,
)
from sentry.tasks.sentry_apps import installation_webhook as old_installation_webhook
from sentry.tasks.sentry_apps import (
    process_resource_change_bound as old_process_resource_change_bound,
)
from sentry.tasks.sentry_apps import retry_decorator
from sentry.tasks.sentry_apps import send_alert_event as old_send_alert_event
from sentry.tasks.sentry_apps import (
    send_resource_change_webhook as old_send_resource_change_webhook,
)
from sentry.tasks.sentry_apps import workflow_notification as old_workflow_notification


@instrumented_task(name="sentry.sentry_apps.tasks.sentry_apps.send_alert_event", **TASK_OPTIONS)
@retry_decorator
def send_alert_event(
    event: Event,
    rule: str,
    sentry_app_id: int,
    additional_payload_key: str | None = None,
    additional_payload: Mapping[str, Any] | None = None,
) -> None:
    old_send_alert_event(
        event=event,
        rule=rule,
        sentry_app_id=sentry_app_id,
        additional_payload_key=additional_payload_key,
        additional_payload=additional_payload,
    )


@instrumented_task(
    "sentry.sentry_apps.tasks.sentry_apps.process_resource_change_bound", bind=True, **TASK_OPTIONS
)
@retry_decorator
def process_resource_change_bound(
    self: Task, action: str, sender: str, instance_id: int, **kwargs: Any
) -> None:
    old_process_resource_change_bound(
        self=self, action=action, sender=sender, instance_id=instance_id, **kwargs
    )


@instrumented_task(
    name="sentry.sentry_apps.tasks.sentry_apps.installation_webhook", **CONTROL_TASK_OPTIONS
)
@retry_decorator
def installation_webhook(installation_id, user_id, *args, **kwargs):
    old_installation_webhook(installation_id=installation_id, user_id=user_id, *args, **kwargs)


@instrumented_task(
    name="sentry.sentry_apps.tasks.sentry_apps.clear_region_cache", **CONTROL_TASK_OPTIONS
)
def clear_region_cache(sentry_app_id: int, region_name: str) -> None:
    old_clear_region_cache(sentry_app_id=sentry_app_id, region_name=region_name)


@instrumented_task(
    name="sentry.sentry_apps.tasks.sentry_apps.workflow_notification", **TASK_OPTIONS
)
@retry_decorator
def workflow_notification(installation_id, issue_id, type, user_id, *args, **kwargs):
    old_workflow_notification(
        installation_id=installation_id,
        issue_id=issue_id,
        type=type,
        user_id=user_id,
        *args,
        **kwargs,
    )


@instrumented_task(
    name="sentry.sentry_apps.tasks.sentry_apps.build_comment_webhook", **TASK_OPTIONS
)
@retry_decorator
def build_comment_webhook(installation_id, issue_id, type, user_id, *args, **kwargs):
    old_build_comment_webhook(
        installation_id=installation_id,
        issue_id=issue_id,
        type=type,
        user_id=user_id,
        *args,
        **kwargs,
    )


@instrumented_task(
    "sentry.sentry_apps.tasks.sentry_apps.send_resource_change_webhook", **TASK_OPTIONS
)
@retry_decorator
def send_resource_change_webhook(installation_id, event, data, *args, **kwargs):
    old_send_resource_change_webhook(
        installation_id=installation_id, event=event, data=data, *args, **kwargs
    )


@instrumented_task(
    "sentry.sentry_apps.tasks.sentry_apps.create_or_update_service_hooks_for_sentry_app",
    **CONTROL_TASK_OPTIONS,
)
def create_or_update_service_hooks_for_sentry_app(
    sentry_app_id: int, webhook_url: str, events: list[str], **kwargs: dict
) -> None:
    old_create_or_update_service_hooks_for_sentry_app(
        sentry_app_id=sentry_app_id, webhook_url=webhook_url, events=events, **kwargs
    )
