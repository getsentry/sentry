import logging
from abc import ABC, abstractmethod
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, cast

import orjson
import requests
import sentry_sdk
from requests import Response
from rest_framework import status

from sentry.silo.base import SiloMode
from sentry.silo.client import RegionSiloClient
from sentry.tasks.base import instrumented_task
from sentry.types.region import Region, get_region_by_name

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class _AsyncResult:
    region: Region
    response: Response

    def was_successful(self) -> bool:
        return 200 <= self.response.status_code < 300


@dataclass(frozen=True)
class _AsyncRegionDispatcher(ABC):
    request_payload: dict[str, Any]
    response_url: str

    @property
    @abstractmethod
    def log_code(self) -> str:
        raise NotImplementedError

    def log_message(self, tag: str) -> str:
        return f"{self.log_code}.{tag}"

    def dispatch(self, region_names: Iterable[str]) -> Response | None:
        results = [self._dispatch_to_region(name) for name in region_names]
        successes = [r for r in results if r.was_successful()]

        logger.info(
            self.log_message("async_region_response"),
            extra={
                "regions": [r.region.name for r in successes],
                "response_map": {r.region.name: r.response.status_code for r in results},
            },
        )

        if successes:
            # Typically we expect only one request to be made or only one successful
            # response. If there are multiple, forward one arbitrarily.
            return self._forward_response(successes[-1])
        else:
            return None

    @abstractmethod
    def unpack_payload(self, response: Response) -> Any:
        raise NotImplementedError

    def _dispatch_to_region(self, region_name: str) -> _AsyncResult:
        region = get_region_by_name(region_name)
        client = RegionSiloClient(region=region)
        response = client.request(
            method=self.request_payload["method"],
            path=self.request_payload["path"],
            headers=self.request_payload["headers"],
            data=self.request_payload["body"].encode("utf-8"),
            json=False,
            raw_response=True,
        )
        return _AsyncResult(region, cast(Response, response))

    def _forward_response(self, result: _AsyncResult) -> Response | None:
        if not result.was_successful():
            raise ValueError("Cannot forward a failed result")
        try:
            response_payload = self.unpack_payload(result.response)
            if response_payload is None:
                return None
            integration_response = requests.post(self.response_url, json=response_payload)
        except Exception as exc:
            sentry_sdk.capture_exception(exc)
            return None
        else:
            logger.info(
                "discord.async_integration_response",
                extra={
                    "path": self.request_payload["path"],
                    "region": result.region.name,
                    "region_status_code": result.response.status_code,
                    "integration_status_code": integration_response.status_code,
                },
            )
            return integration_response


class _AsyncSlackDispatcher(_AsyncRegionDispatcher):
    @property
    def log_code(self) -> str:
        return "slack"

    def unpack_payload(self, response: Response) -> Any:
        return orjson.loads(response.content)


@instrumented_task(
    name="sentry.middleware.integrations.tasks.convert_to_async_slack_response",
    queue="integrations.control",
    silo_mode=SiloMode.CONTROL,
    max_retries=2,
    default_retry_delay=5,
    record_timing=True,
)
def convert_to_async_slack_response(
    region_names: list[str],
    payload: dict[str, Any],
    response_url: str,
):
    _AsyncSlackDispatcher(payload, response_url).dispatch(region_names)


class _AsyncDiscordDispatcher(_AsyncRegionDispatcher):
    @property
    def log_code(self) -> str:
        return "discord"

    def unpack_payload(self, response: Response) -> Any:
        # Region will return a response assuming it's meant to go directly to Discord. Since we're
        # handling the request asynchronously, we extract only the data, and post it to the webhook
        # that discord provides.
        # https://discord.com/developers/docs/interactions/receiving-and-responding#followup-messages
        return orjson.loads(response.content).get("data")


@instrumented_task(
    name="sentry.middleware.integrations.tasks.convert_to_async_discord_response",
    queue="integrations.control",
    silo_mode=SiloMode.CONTROL,
    max_retries=2,
    default_retry_delay=5,
)
def convert_to_async_discord_response(
    region_names: list[str],
    payload: dict[str, Any],
    response_url: str,
) -> None:
    """
    This task asks relevant region silos for response data to send asynchronously to Discord. It
    assumes Discord has received a callback of type:5 (DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE).
    (See https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-response-object-interaction-callback-type)

    In the event this task finishes prior to returning the above type, the outbound post will fail.
    """
    response = _AsyncDiscordDispatcher(payload, response_url).dispatch(region_names)

    if response is not None and response.status_code == status.HTTP_404_NOT_FOUND:
        raise Exception("Discord hook is not ready.")
