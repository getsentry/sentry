from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.integrations.tasks.slack.post_message import post_message as new_post_message
from sentry.integrations.tasks.slack.post_message import (
    post_message_control as new_post_message_control,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task


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
    new_post_message(integration_id, payload, log_error_message, log_params)


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
    new_post_message_control(integration_id, payload, log_error_message, log_params)
