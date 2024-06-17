from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from slack_sdk.errors import SlackApiError

from sentry.integrations.slack.metrics import (
    SLACK_NOTIFY_RECIPIENT_FAILURE_DATADOG_METRIC,
    SLACK_NOTIFY_RECIPIENT_SUCCESS_DATADOG_METRIC,
)
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

logger = logging.getLogger("sentry.integrations.slack.tasks")


def _send_message_to_slack_channel(
    integration_id: int,
    payload: Mapping[str, Any],
    log_error_message: str,
    log_params: Mapping[str, Any],
    has_sdk_flag: bool | None = False,  # TODO: remove all these
) -> None:
    sdk_client = SlackSdkClient(integration_id=integration_id)
    try:
        sdk_client.chat_postMessage(
            blocks=str(payload.get("blocks", "")),
            text=str(payload.get("text", "")),
            channel=str(payload.get("channel", "")),
            unfurl_links=False,
            unfurl_media=False,
        )
        metrics.incr(SLACK_NOTIFY_RECIPIENT_SUCCESS_DATADOG_METRIC, sample_rate=1.0)
    except SlackApiError as e:
        extra = {"error": str(e), **log_params}
        logger.info(log_error_message, extra=extra)
        metrics.incr(
            SLACK_NOTIFY_RECIPIENT_FAILURE_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"ok": e.response.get("ok", False), "status": e.response.status_code},
        )


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
    )
