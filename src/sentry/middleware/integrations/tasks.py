import logging
from typing import Any, Dict, List, MutableMapping, cast

import requests
import sentry_sdk
from requests import Response

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
def convert_to_async_slack_response(
    region_names: List[str],
    payload: Dict[str, Any],
    response_url: str,
):
    webhook_payload = ControlOutbox.get_webhook_payload_from_outbox(payload=payload)
    regions = [get_region_by_name(rn) for rn in region_names]
    region_to_response_map: MutableMapping[str, Response] = {}
    result: MutableMapping[str, Any] = {"response": None, "region": None}
    for region in regions:
        region_response = RegionSiloClient(region=region).request(
            method=webhook_payload.method,
            path=webhook_payload.path,
            headers=webhook_payload.headers,
            data=webhook_payload.body,
            json=False,
            raw_response=True,
        )
        region_response = cast(Response, region_response)
        region_to_response_map[region.name] = region_response
        if region_response.status_code > 200 and region_response.status_code < 300:
            result["response"] = region_response
            result["region"] = region

    logger.info(
        "slack.async_region_response",
        extra={
            "region": result["region"],
            "response_map": {
                region_name: response.status_code
                for region_name, response in region_to_response_map.items()
            },
        },
    )

    try:
        payload = json.loads(result["response"].content.decode(encoding="utf-8"))
        integration_response = requests.post(response_url, json=payload)
        logger.info(
            "slack.async_integration_response",
            extra={
                "path": webhook_payload.path,
                "region": result["region"],
                "region_status_code": result["response"].status_code,
                "integration_status_code": integration_response.status_code,
            },
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


@instrumented_task(
    name="sentry.middleware.integrations.tasks.convert_to_async_discord_response",
    queue="integrations.control",
    silo_mode=SiloMode.CONTROL,
)
def convert_to_async_discord_response(
    region_names: List[str],
    payload: Dict[str, Any],
    response_url: str,
):
    webhook_payload = ControlOutbox.get_webhook_payload_from_outbox(payload=payload)
    regions = [get_region_by_name(rn) for rn in region_names]
    region_to_response_map: MutableMapping[str, Response] = {}
    result: MutableMapping[str, Any] = {"response": None, "region": None}
    for region in regions:
        region_response = RegionSiloClient(region=region).request(
            method=webhook_payload.method,
            path=webhook_payload.path,
            headers=webhook_payload.headers,
            data=webhook_payload.body.encode("utf-8"),
            json=False,
            raw_response=True,
        )
        region_response = cast(Response, region_response)
        region_to_response_map[region.name] = region_response
        if region_response.status_code > 200 and region_response.status_code < 300:
            result["response"] = region_response
            result["region"] = region

    logger.info(
        "discord.async_region_response",
        extra={
            "region": result["region"],
            "response_map": {
                region_name: response.status_code
                for region_name, response in region_to_response_map.items()
            },
        },
    )

    try:
        # Region will return a response assuming it's meant to go directly to Discord. Since it
        # we're handling the request asynchronously, we extract only the data, and post it to
        # the webhook endpoint.
        payload = json.loads(result["response"].content.decode(encoding="utf-8")).get("data")
        integration_response = requests.post(response_url, json=payload)
        logger.info(
            "discord.async_integration_response",
            extra={
                "path": webhook_payload.path,
                "region": result["region"],
                "region_status_code": result["response"].status_code,
                "integration_status_code": integration_response.status_code,
            },
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)
