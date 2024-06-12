from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from slack_sdk.errors import SlackApiError

from sentry.integrations.slack.client import SlackClient
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task

logger = logging.getLogger("sentry.integrations.slack.tasks")


def _send_message_to_slack_channel(
    integration_id: int,
    payload: Mapping[str, Any],
    log_error_message: str,
    log_params: Mapping[str, Any],
    has_sdk_flag: bool | None = False,
) -> None:
    if has_sdk_flag:
        sdk_client = SlackSdkClient(integration_id=integration_id)
        try:
            sdk_client.chat_postMessage(
                blocks=str(payload.get("blocks", "")),
                text=str(payload.get("text", "")),
                channel=str(payload.get("channel", "")),
                unfurl_links=False,
                unfurl_media=False,
            )
            logger.info("slack.send_message_to_channel.success", extra=log_params)
        except SlackApiError as e:
            extra = {"error": str(e), **log_params}
            logger.info(log_error_message, extra=extra)
    else:
        client = SlackClient(integration_id=integration_id)
        try:
            client.post("/chat.postMessage", data=payload, timeout=5)
        except ApiError as e:
            extra = {"error": str(e), **log_params}
            logger.info(log_error_message, extra=extra)


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
    has_sdk_flag: bool | None = False,
) -> None:
    _send_message_to_slack_channel(
        integration_id=integration_id,
        payload=payload,
        log_error_message=log_error_message,
        log_params=log_params,
        has_sdk_flag=has_sdk_flag,
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
    has_sdk_flag: bool,
) -> None:
    _send_message_to_slack_channel(
        integration_id=integration_id,
        payload=payload,
        log_error_message=log_error_message,
        log_params=log_params,
        has_sdk_flag=has_sdk_flag,
    )
