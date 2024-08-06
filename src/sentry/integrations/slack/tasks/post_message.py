from collections.abc import Mapping
from typing import Any

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tasks.integrations.slack.post_message import post_message as old_post_message
from sentry.tasks.integrations.slack.post_message import (
    post_message_control as old_post_message_control,
)


@instrumented_task(
    name="sentry.integrations.slack.tasks.post_message",
    queue="integrations",
    max_retries=0,
    silo_mode=SiloMode.REGION,
)
def post_message(
    integration_id: int,
    payload: Mapping[str, Any],
    log_error_message: str,
    log_params: Mapping[str, Any],
) -> None:
    old_post_message(
        integration_id=integration_id,
        payload=payload,
        log_error_message=log_error_message,
        log_params=log_params,
    )


@instrumented_task(
    name="sentry.integrations.slack.tasks.post_message_control",
    queue="integrations.control",
    max_retries=0,
    silo_mode=SiloMode.CONTROL,
)
def post_message_control(
    integration_id: int,
    payload: Mapping[str, Any],
    log_error_message: str,
    log_params: Mapping[str, Any],
) -> None:
    old_post_message_control(
        integration_id=integration_id,
        payload=payload,
        log_error_message=log_error_message,
        log_params=log_params,
    )
