import logging
from typing import Any, Dict, List

import requests
import sentry_sdk

from sentry.models.outbox import ControlOutbox
from sentry.silo.base import SiloMode
from sentry.silo.client import RegionSiloClient
from sentry.tasks.base import instrumented_task
from sentry.types.region import get_region_by_name
from sentry.utils import json

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.middleware.integrations.tasks.convert_to_async_slack_response",
    queue="integrations.control",
    silo_mode=SiloMode.CONTROL,
)
def convert_to_async_slack_response(payload: Dict[str, Any], region_names: List[str]):
    logger.info("####-Starting convert_to_async_slack_response")  # can't seem to get this to run?
    webhook_payload = ControlOutbox.get_webhook_payload_from_outbox(payload=payload)
    regions = [get_region_by_name(rn) for rn in region_names]
    # TODO: Refactor out of a for loop, just testing if this works
    for region in regions:
        response = RegionSiloClient(region=region).request(
            method=webhook_payload.method,
            path=webhook_payload.path,
            headers=webhook_payload.headers,
            data=webhook_payload.body,
            json=False,
        )
        try:
            request_data = json.loads(webhook_payload.body.decode(encoding="utf-8"))
            response_url = request_data.get("response_url")
            payload = json.loads(response.content.decode(encoding="utf-8"))
            response = requests.post(response_url, json=payload)
            logger.info(
                "slack.async_response",
                extra={"path": webhook_payload.path, "status_code": response.status_code},
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)


@instrumented_task(
    name="sentry.middleware.integrations.tasks.convert_to_async_discord_response",
    queue="integrations",
    silo_mode=SiloMode.CONTROL,
)
def convert_to_async_discord_response(payload: Dict[str, Any], region_names: List[str]):
    logger.info("####-Starting convert_to_async_discord_response")  # can't seem to get this to run?
    webhook_payload = ControlOutbox.get_webhook_payload_from_outbox(payload=payload)
    regions = [get_region_by_name(rn) for rn in region_names]

    # TODO: Refactor out of a for loop, just testing if this works
    for region in regions:
        response = RegionSiloClient(region=region).request(
            method=webhook_payload.method,
            path=webhook_payload.path,
            headers=webhook_payload.headers,
            data=webhook_payload.body,
            json=False,
        )
        try:
            request_data = json.loads(webhook_payload.body.decode(encoding="utf-8"))
            application_id = request_data.get("application_id")
            token = request_data.get("token")
            response_url = f"https://discord.com/api/v10/webhooks/{application_id}/{token}"
            payload = json.loads(response.content.decode(encoding="utf-8")).get("data")
            response = requests.post(response_url, json=payload)
            logger.info(
                "discord.async_response",
                extra={"path": webhook_payload.path, "status_code": response.status_code},
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)
