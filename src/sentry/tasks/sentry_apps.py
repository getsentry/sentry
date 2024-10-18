from collections.abc import Mapping
from typing import Any

from celery import Task

from sentry.eventstore.models import Event
from sentry.sentry_apps.tasks.sentry_apps import CONTROL_TASK_OPTIONS, TASK_OPTIONS
from sentry.sentry_apps.tasks.sentry_apps import build_comment_webhook as new_build_comment_webhook
from sentry.sentry_apps.tasks.sentry_apps import clear_region_cache as new_clear_region_cache
from sentry.sentry_apps.tasks.sentry_apps import (
    create_or_update_service_hooks_for_sentry_app as new_create_or_update_service_hooks_for_sentry_app,
)
from sentry.sentry_apps.tasks.sentry_apps import installation_webhook as new_installation_webhook
from sentry.sentry_apps.tasks.sentry_apps import (
    process_resource_change_bound as new_process_resource_change_bound,
)
from sentry.sentry_apps.tasks.sentry_apps import retry_decorator
from sentry.sentry_apps.tasks.sentry_apps import send_alert_event as new_send_alert_event
from sentry.sentry_apps.tasks.sentry_apps import (
    send_resource_change_webhook as new_send_resource_change_webhook,
)
from sentry.sentry_apps.tasks.sentry_apps import workflow_notification as new_workflow_notification
from sentry.tasks.base import instrumented_task


@instrumented_task(name="sentry.tasks.sentry_apps.send_alert_event", **TASK_OPTIONS)
@retry_decorator
def send_alert_event(
    event: Event,
    rule: str,
    sentry_app_id: int,
    additional_payload_key: str | None = None,
    additional_payload: Mapping[str, Any] | None = None,
) -> None:
    new_send_alert_event(
        event=event,
        rule=rule,
        sentry_app_id=sentry_app_id,
        additional_payload_key=additional_payload_key,
        additional_payload=additional_payload,
    )


@instrumented_task("sentry.tasks.process_resource_change_bound", bind=True, **TASK_OPTIONS)
@retry_decorator
def process_resource_change_bound(
    self: Task, action: str, sender: str, instance_id: int, **kwargs: Any
) -> None:
    new_process_resource_change_bound(
        action=action, sender=sender, instance_id=instance_id, **kwargs
    )


@instrumented_task(name="sentry.tasks.sentry_apps.installation_webhook", **CONTROL_TASK_OPTIONS)
@retry_decorator
def installation_webhook(installation_id: int, user_id: int, *args: Any, **kwargs: Any) -> None:
    new_installation_webhook(installation_id=installation_id, user_id=user_id, *args, **kwargs)


@instrumented_task(
    name="sentry.sentry_apps.tasks.installations.clear_region_cache", **CONTROL_TASK_OPTIONS
)
def clear_region_cache(sentry_app_id: int, region_name: str) -> None:
    new_clear_region_cache(sentry_app_id=sentry_app_id, region_name=region_name)


@instrumented_task(name="sentry.tasks.sentry_apps.workflow_notification", **TASK_OPTIONS)
@retry_decorator
def workflow_notification(
    installation_id: int, issue_id: int, type: str, user_id: int, *args: Any, **kwargs: Any
) -> None:
    new_workflow_notification(
        installation_id=installation_id,
        issue_id=issue_id,
        type=type,
        user_id=user_id,
        *args,
        **kwargs,
    )


@instrumented_task(name="sentry.tasks.sentry_apps.build_comment_webhook", **TASK_OPTIONS)
@retry_decorator
def build_comment_webhook(
    installation_id: int, issue_id: int, type: str, user_id: int, *args: Any, **kwargs: Any
) -> None:
    new_build_comment_webhook(
        installation_id=installation_id,
        issue_id=issue_id,
        type=type,
        user_id=user_id,
        *args,
        **kwargs,
    )


@instrumented_task("sentry.tasks.send_process_resource_change_webhook", **TASK_OPTIONS)
@retry_decorator
def send_resource_change_webhook(
    installation_id: int, event: str, data: dict[str, Any], *args: Any, **kwargs: Any
) -> None:
    new_send_resource_change_webhook(
        installation_id=installation_id, event=event, data=data, *args, **kwargs
    )


@instrumented_task(
    "sentry.tasks.create_or_update_service_hooks_for_sentry_app", **CONTROL_TASK_OPTIONS
)
def create_or_update_service_hooks_for_sentry_app(
    sentry_app_id: int, webhook_url: str, events: list[str], **kwargs: dict
) -> None:
    new_create_or_update_service_hooks_for_sentry_app(
        sentry_app_id=sentry_app_id, webhook_url=webhook_url, events=events, **kwargs
    )
