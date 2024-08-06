from collections.abc import Mapping
from typing import Any

from sentry.integrations.slack.tasks.post_message import post_message as new_post_message
from sentry.integrations.slack.tasks.post_message import (
    post_message_control as new_post_message_control,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task


# TODO: add retry logic
@instrumented_task(
    name="sentry.integrations.slack.post_message",
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
    new_post_message(
        integration_id=integration_id,
        payload=payload,
        log_error_message=log_error_message,
        log_params=log_params,
    )


# TODO: add retry logic
@instrumented_task(
    name="sentry.integrations.slack.post_message_control",
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
    new_post_message_control(
        integration_id=integration_id,
        payload=payload,
        log_error_message=log_error_message,
        log_params=log_params,
    )
